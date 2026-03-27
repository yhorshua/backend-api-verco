import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { ScanItemDto } from './dto/scan-item.dto';
import { Escaneo } from '../database/entities/escaneo.entity';
import { OrderDetail } from '../database/entities/order-details.entity';
import { Product } from '../database/entities/product.entity';
import { Order } from 'src/database/entities/orders.entity';
import { Stock } from 'src/database/entities/stock.entity';
import { StockReservation } from 'src/database/entities/stock_reservations.entity';
import { StockReservationStatus } from 'src/database/entities/stock-reservation-status.enum';
import { InventoryMovement } from 'src/database/entities/inventory-movements.entity';
import { OrderStatusEnum } from 'src/orders/dto/orderStatusEnum';

@Injectable()
export class PackingService {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(Escaneo)
    private readonly escaneoRepo: Repository<Escaneo>,

    @InjectRepository(OrderDetail)
    private readonly orderDetailRepo: Repository<OrderDetail>,

    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) { }

  async getPacking(orderId: number) {
    const scans = await this.escaneoRepo.find({
      where: { id_pedido: orderId } as any,
      order: { fecha_escaner: 'ASC' } as any,
    });

    const grouped = new Map<string, { codigo_producto: string; talla: string; cantidad: number }>();
    for (const s of scans as any[]) {
      const key = `${s.codigo_producto}|${s.talla}`;
      if (!grouped.has(key)) {
        grouped.set(key, { codigo_producto: s.codigo_producto, talla: s.talla, cantidad: 0 });
      }
      grouped.get(key)!.cantidad += Number(s.cantidad);
    }

    return { scans, grouped: Array.from(grouped.values()) };
  }

  async scanItem(dto: ScanItemDto) {
    if (!dto.order_id) throw new BadRequestException('order_id es requerido');
    if (!dto.codigo_producto?.trim()) throw new BadRequestException('codigo_producto es requerido');
    if (!dto.talla?.trim()) throw new BadRequestException('talla es requerido');
    if (!Number.isFinite(dto.cantidad) || dto.cantidad <= 0) {
      throw new BadRequestException('cantidad debe ser > 0');
    }

    return this.dataSource.transaction(async (manager) => {
      const escaneoRepo = manager.getRepository(Escaneo);
      const orderDetailRepo = manager.getRepository(OrderDetail);
      const productRepo = manager.getRepository(Product);

      // 1) validar contra Order_Details
      const details = await orderDetailRepo.find({ where: { order_id: dto.order_id } as any });
      if (!details.length) throw new BadRequestException('Pedido sin detalles');

      // 2) convertir codigo_producto -> product_id (sin traer toda la tabla)
      const product = await productRepo.findOne({
        where: { article_code: dto.codigo_producto } as any,
        select: ['id', 'article_code'] as any,
      });
      if (!product) throw new BadRequestException(`Código no existe: ${dto.codigo_producto}`);

      const line = await orderDetailRepo.findOne({
        where: {
          order_id: dto.order_id,
          product_id: product.id,
          size: dto.talla,
        } as any,
        lock: { mode: 'pessimistic_write' },
      });
      if (!line) {
        throw new BadRequestException(
          `El producto/talla no está en el pedido: ${dto.codigo_producto} ${dto.talla}`,
        );
      }

      // 3) sumar escaneado actual (solo de ese producto/talla)
      const scannedAgg = await escaneoRepo
        .createQueryBuilder('e')
        .select('COALESCE(SUM(e.cantidad), 0)', 'qty')
        .where('e.id_pedido = :orderId', { orderId: dto.order_id })
        .andWhere('e.codigo_producto = :code', { code: dto.codigo_producto })
        .andWhere('e.talla = :talla', { talla: dto.talla })
        .getRawOne<{ qty: string | number }>();

      const scannedQty = Number(scannedAgg?.qty ?? 0);
      const orderedQty = Number((line as any).quantity);

      if (scannedQty + Number(dto.cantidad) > orderedQty) {
        throw new BadRequestException(
          `Excede lo pedido. Pedido=${orderedQty} Escaneado=${scannedQty}`,
        );
      }

      // 4) guardar escaneo
      const esc = escaneoRepo.create({
        id_pedido: dto.order_id,
        codigo_producto: dto.codigo_producto,
        talla: dto.talla,
        cantidad: dto.cantidad,
      } as any);

      await escaneoRepo.save(esc);

      return { ok: true };
    });
  }

  async closePacking(orderId: number, userId: number) {
    return this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(Order);
      const detailRepo = manager.getRepository(OrderDetail);
      const stockRepo = manager.getRepository(Stock);
      const reservationRepo = manager.getRepository(StockReservation);
      const movementRepo = manager.getRepository(InventoryMovement);
      const escaneoRepo = manager.getRepository(Escaneo);
      const productRepo = manager.getRepository(Product);

      /* ============================================================
         1️⃣ VALIDAR PEDIDO
      ============================================================ */
      const order = await orderRepo.findOne({ where: { id: orderId } });
      if (!order) throw new NotFoundException('Pedido no encontrado');

      // 🔥 IDPOTENCIA
      if (order.order_status_id >= OrderStatusEnum.ALISTADO) {
        return { ok: true, message: 'Pedido ya procesado' };
      }

      // 🔥 FLUJO CORRECTO
      if (order.order_status_id !== OrderStatusEnum.APROBADO) {
        throw new BadRequestException(
          'Solo pedidos aprobados pueden pasar a packing',
        );
      }

      const details = await detailRepo.find({
        where: { order_id: orderId },
      });

      if (!details.length) {
        throw new BadRequestException('Pedido sin detalles');
      }

      /* ============================================================
         2️⃣ DATA NECESARIA (OPTIMIZADO)
      ============================================================ */

      const productIds = details.map((d: any) => d.product_id);

      const products = await productRepo.find({
        where: { id: productIds as any },
        select: ['id', 'article_code'] as any,
      });

      const codeById = new Map(
        products.map((p: any) => [p.id, p.article_code]),
      );

      const escaneos = await escaneoRepo.find({
        where: { id_pedido: orderId } as any,
      });

      /* ============================================================
         3️⃣ VALIDAR ESCANEOS INVÁLIDOS
      ============================================================ */
      for (const e of escaneos as any[]) {
        const existe = details.some((d: any) => {
          const code = codeById.get(d.product_id);
          return code === e.codigo_producto && d.size === e.talla;
        });

        if (!existe) {
          throw new BadRequestException(
            `Escaneo inválido: ${e.codigo_producto} talla ${e.talla}`,
          );
        }
      }

      /* ============================================================
         4️⃣ VALIDAR PACKING COMPLETO
      ============================================================ */

      const scanMap = new Map<string, number>();

      escaneos.forEach((e: any) => {
        const key = `${e.codigo_producto}|${e.talla}`;
        scanMap.set(key, (scanMap.get(key) || 0) + Number(e.cantidad));
      });

      for (const d of details as any[]) {
        const code = codeById.get(d.product_id);
        const key = `${code}|${d.size}`;

        const escaneado = scanMap.get(key) || 0;
        const solicitado = Number(d.quantity);

        if (escaneado < solicitado) {
          throw new BadRequestException(
            `Packing incompleto: ${code} talla ${d.size} → ${escaneado}/${solicitado}`,
          );
        }

        if (escaneado > solicitado) {
          throw new BadRequestException(
            `Packing excedido: ${code} talla ${d.size}`,
          );
        }
      }

      /* ============================================================
         5️⃣ VALIDAR RESERVAS
      ============================================================ */
      const reservas = await reservationRepo.find({
        where: {
          order_id: orderId,
          status: StockReservationStatus.RESERVADO,
        },
      });

      if (!reservas.length) {
        throw new BadRequestException('No hay reservas para este pedido');
      }

      const totalReservado = reservas.reduce(
        (acc, r) => acc + Number(r.quantity),
        0,
      );

      const totalPedido = details.reduce(
        (acc, d) => acc + Number(d.quantity),
        0,
      );

      if (totalReservado < totalPedido) {
        throw new BadRequestException('Reservas incompletas');
      }

      /* ============================================================
         6️⃣ TRAER STOCK (OPTIMIZADO)
      ============================================================ */
      const stocks = await stockRepo.find({
        where: {
          warehouse_id: order.warehouse_id,
          product_id: productIds as any,
        },
      });

      const stockMap = new Map(
        stocks.map(
          (s) => [`${s.product_id}|${s.product_size_id ?? null}`, s],
        ),
      );

      /* ============================================================
         7️⃣ DESCONTAR STOCK + MOVIMIENTOS
      ============================================================ */
      for (const d of details as any[]) {
        const key = `${d.product_id}|${d.product_size_id ?? null}`;
        const stock = stockMap.get(key);

        if (!stock) {
          throw new BadRequestException('Stock no encontrado');
        }

        // 🔒 LOCK
        await stockRepo.findOne({
          where: { id: stock.id } as any,
          lock: { mode: 'pessimistic_write' },
        });

        if (Number(stock.quantity) < Number(d.quantity)) {
          throw new BadRequestException(
            `Stock insuficiente al cerrar packing`,
          );
        }

        // 👉 descontar
        stock.quantity -= Number(d.quantity);
        await stockRepo.save(stock);

        // 👉 movimiento
        await movementRepo.save(
          movementRepo.create({
            warehouse_id: order.warehouse_id,
            product_id: d.product_id,
            product_size_id: d.product_size_id ?? null,
            quantity: d.quantity,
            movement_type: 'OUT',
            reference_id: order.id,
            user_id: userId,
            unit_of_measure: 'PAR', // 🔥 ajusta según negocio
            remarks: `Salida por pedido ${order.id}`,
          }),
        );
      }

      /* ============================================================
         8️⃣ CONSUMIR RESERVA
      ============================================================ */
      await reservationRepo.update(
        {
          order_id: orderId,
          status: StockReservationStatus.RESERVADO,
        },
        {
          status: StockReservationStatus.CONSUMIDO,
        },
      );

      /* ============================================================
         9️⃣ CAMBIAR ESTADO
      ============================================================ */
      order.order_status_id = OrderStatusEnum.ALISTADO;
      await orderRepo.save(order);

      return {
        ok: true,
        message: 'Packing cerrado correctamente',
      };
    });
  }


  async getScanStatus(orderId: number) {
    const orderDetails = await this.orderDetailRepo.find({
      where: { order_id: orderId } as any,
    });

    if (!orderDetails.length) {
      throw new BadRequestException('Pedido sin detalles');
    }

    const escaneos = await this.escaneoRepo.find({
      where: { id_pedido: orderId } as any,
    });

    // 🔥 map product_id -> article_code
    const productIds = Array.from(new Set(orderDetails.map((d: any) => d.product_id)));

    const products = await this.productRepo.find({
      where: { id: productIds as any },
      select: ['id', 'article_code'] as any,
    });

    const codeById = new Map(products.map((p: any) => [p.id, p.article_code]));

    // 🔥 scan map
    const scanMap = new Map<string, number>();
    escaneos.forEach((escaneo: any) => {
      const key = `${escaneo.codigo_producto}|${escaneo.talla}`;
      scanMap.set(key, (scanMap.get(key) || 0) + Number(escaneo.cantidad));
    });

    const status = orderDetails.map((detail: any) => {
      const code = codeById.get(detail.product_id);
      const key = `${code}|${detail.size}`;

      const escaneado = scanMap.get(key) || 0;
      const solicitado = Number(detail.quantity);

      return {
        codigo: code,
        talla: detail.size,
        escaneado,
        solicitado,
        completo: escaneado >= solicitado,
      };
    });

    return status;
  }

}


