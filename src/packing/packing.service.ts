import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';

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

  private productCache = new Map<string, number>();

  private orderCache = new Map<
    number,
    Map<string, { product_id: number; orderedQty: number }>
  >();

  private scanCache = new Map<string, number>();

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
    if (!dto.codigo_producto?.trim())
      throw new BadRequestException('codigo_producto es requerido');
    if (!dto.talla?.trim())
      throw new BadRequestException('talla es requerido');
    if (!Number.isFinite(dto.cantidad) || dto.cantidad <= 0) {
      throw new BadRequestException('cantidad debe ser > 0');
    }

    const codigo = dto.codigo_producto.trim().toUpperCase();
    const talla = dto.talla.trim().toUpperCase();

    return this.dataSource.transaction(async (manager) => {
      /* ============================================================
         1️⃣ PRODUCT CACHE
      ============================================================ */
      let productId = this.productCache.get(codigo);

      if (!productId) {
        const product = await manager.findOne(Product, {
          where: { article_code: codigo } as any,
          select: ['id'] as any,
        });

        if (!product) {
          throw new BadRequestException(`Código no existe: ${codigo}`);
        }

        productId = product.id;
        this.productCache.set(codigo, productId);
      }

      /* ============================================================
         2️⃣ ORDER CACHE (🔥 SOLO SE CARGA UNA VEZ)
      ============================================================ */
      let orderMap = this.orderCache.get(dto.order_id);

      if (!orderMap) {
        const details = await manager.getRepository(OrderDetail).find({
          where: { order_id: dto.order_id } as any,
        });

        if (!details.length) {
          throw new BadRequestException('Pedido sin detalles');
        }

        orderMap = new Map();

        for (const d of details) {
          const key = `${d.product_id}|${String(d.size).toUpperCase()}`;
          orderMap.set(key, {
            product_id: d.product_id,
            orderedQty: Number(d.quantity),
          });
        }

        this.orderCache.set(dto.order_id, orderMap);
      }

      const key = `${productId}|${talla}`;
      const line = orderMap.get(key);

      if (!line) {
        throw new BadRequestException(
          `Producto/talla no pertenece al pedido`,
        );
      }

      /* ============================================================
         3️⃣ SCAN CACHE (🔥 0 QUERIES VALIDACIÓN)
      ============================================================ */
      const scanKey = `${dto.order_id}|${codigo}|${talla}`;

      const scannedQty = this.scanCache.get(scanKey) || 0;
      const orderedQty = line.orderedQty;

      if (scannedQty + dto.cantidad > orderedQty) {
        throw new BadRequestException(
          `Excede lo pedido. Pedido=${orderedQty} Escaneado=${scannedQty}`,
        );
      }

      // actualizar cache en memoria
      this.scanCache.set(scanKey, scannedQty + dto.cantidad);

      /* ============================================================
         4️⃣ INSERT DIRECTO (ULTRA RÁPIDO)
      ============================================================ */
      await manager.insert(Escaneo, {
        id_pedido: dto.order_id,
        codigo_producto: codigo,
        talla,
        cantidad: dto.cantidad,
      });

      return { ok: true };
    });
  }

  /* ============================================================
     🧹 LIMPIAR CACHE CUANDO TERMINA PACKING
  ============================================================ */
  clearOrderCache(orderId: number) {
    this.orderCache.delete(orderId);

    // limpiar scans relacionados
    for (const key of this.scanCache.keys()) {
      if (key.startsWith(orderId + '|')) {
        this.scanCache.delete(key);
      }
    }
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
      if (order.order_status_id !== OrderStatusEnum.EN_ALISTAMIENTO) {
        throw new BadRequestException(
          'El pedido no está en alistamiento',
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

      const productIds = [...new Set(details.map((d: any) => d.product_id))];

      const products = await productRepo.find({
        where: { id: In(productIds) },
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
          status: In([
            StockReservationStatus.RESERVADO,
            // 🔥 soporta dropshipping si agregas DIRECTO
            StockReservationStatus.DIRECTO as any,
          ]),
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
          (s) => [`${s.product_id}|${s.product_size_id || 0}`, s],
        ),
      );

      /* ============================================================
         7️⃣ DESCONTAR STOCK + MOVIMIENTOS
      ============================================================ */
      for (const d of details as any[]) {
        const key = `${d.product_id}|${d.product_size_id || 0}`;
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
          status: In([
            StockReservationStatus.RESERVADO,
            StockReservationStatus.DIRECTO,
          ]),
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

  async startPacking(orderId: number) {
    return this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(Order);

      const order = await orderRepo.findOne({
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) throw new NotFoundException('Pedido no encontrado');

      if (order.order_status_id !== OrderStatusEnum.APROBADO) {
        throw new BadRequestException('Pedido no válido para packing');
      }

      order.order_status_id = OrderStatusEnum.EN_ALISTAMIENTO;

      await orderRepo.save(order);

      return { ok: true, message: 'Packing iniciado' };
    });
  }

}


