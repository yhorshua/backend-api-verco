import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';

import { ScanItemsBulkDto } from './dto/scan-item.dto';
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

  async scanItemsBulk(dto: ScanItemsBulkDto) {
  if (!dto.order_id) {
    throw new BadRequestException('order_id es requerido');
  }

  if (!dto.items?.length) {
    throw new BadRequestException('items es requerido');
  }

  const groupedMap = new Map<
    string,
    {
      codigo_producto: string;
      talla: string;
      cantidad: number;
    }
  >();

  for (const item of dto.items) {
    if (!item.codigo_producto?.trim()) {
      throw new BadRequestException('codigo_producto es requerido');
    }

    if (!item.talla?.trim()) {
      throw new BadRequestException('talla es requerido');
    }

    const cantidad = Number(item.cantidad);

    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      throw new BadRequestException('cantidad debe ser > 0');
    }

    const codigo = item.codigo_producto.trim().toUpperCase();
    const talla = item.talla.trim().toUpperCase();

    const key = `${codigo}|${talla}`;

    const prev = groupedMap.get(key);

    if (prev) {
      prev.cantidad += cantidad;
    } else {
      groupedMap.set(key, {
        codigo_producto: codigo,
        talla,
        cantidad,
      });
    }
  }

  const groupedItems = Array.from(groupedMap.values());

  return this.dataSource.transaction(async (manager) => {
    const productRepo = manager.getRepository(Product);
    const orderDetailRepo = manager.getRepository(OrderDetail);
    const escaneoRepo = manager.getRepository(Escaneo);

    const codes = [...new Set(groupedItems.map((i) => i.codigo_producto))];

    // ===============================
    // 1. Buscar productos en una sola consulta
    // ===============================
    const products = await productRepo
      .createQueryBuilder('p')
      .select(['p.id', 'p.article_code'])
      .where('p.article_code IN (:...codes)', { codes })
      .getMany();

    const productByCode = new Map(
      products.map((p) => [p.article_code.trim().toUpperCase(), p]),
    );

    const missingCodes = codes.filter((code) => !productByCode.has(code));

    if (missingCodes.length > 0) {
      throw new BadRequestException(
        `Códigos no existen: ${missingCodes.join(', ')}`,
      );
    }

    const productIds = products.map((p) => p.id);

    // ===============================
    // 2. Traer detalles del pedido
    // ===============================
    const orderDetails = await orderDetailRepo
      .createQueryBuilder('d')
      .select([
        'd.id',
        'd.order_id',
        'd.product_id',
        'd.size',
        'd.quantity',
      ])
      .where('d.order_id = :orderId', {
        orderId: dto.order_id,
      })
      .andWhere('d.product_id IN (:...productIds)', {
        productIds,
      })
      .getMany();

    if (!orderDetails.length) {
      throw new BadRequestException('Pedido sin detalles válidos');
    }

    const orderMap = new Map<
      string,
      {
        product_id: number;
        talla: string;
        orderedQty: number;
      }
    >();

    for (const d of orderDetails) {
      const talla = String(d.size).trim().toUpperCase();
      const key = `${d.product_id}|${talla}`;

      orderMap.set(key, {
        product_id: d.product_id,
        talla,
        orderedQty: Number(d.quantity || 0),
      });
    }

    // ===============================
    // 3. Consultar escaneos existentes
    // ===============================
    const scannedRows = await escaneoRepo
      .createQueryBuilder('e')
      .select('e.codigo_producto', 'codigo_producto')
      .addSelect('e.talla', 'talla')
      .addSelect('SUM(e.cantidad)', 'cantidad')
      .where('e.id_pedido = :orderId', {
        orderId: dto.order_id,
      })
      .groupBy('e.codigo_producto')
      .addGroupBy('e.talla')
      .getRawMany();

    const scannedMap = new Map<string, number>();

    for (const row of scannedRows) {
      const codigo = String(row.codigo_producto).trim().toUpperCase();
      const talla = String(row.talla).trim().toUpperCase();

      scannedMap.set(`${codigo}|${talla}`, Number(row.cantidad || 0));
    }

    // ===============================
    // 4. Validar lote completo
    // ===============================
    const inserts: Partial<Escaneo>[] = [];

    for (const item of groupedItems) {
      const product = productByCode.get(item.codigo_producto);

      if (!product) {
        throw new BadRequestException(
          `Código no existe: ${item.codigo_producto}`,
        );
      }

      const orderKey = `${product.id}|${item.talla}`;
      const orderLine = orderMap.get(orderKey);

      if (!orderLine) {
        throw new BadRequestException(
          `Producto/talla no pertenece al pedido: ${item.codigo_producto} talla ${item.talla}`,
        );
      }

      const scanKey = `${item.codigo_producto}|${item.talla}`;
      const scannedQty = scannedMap.get(scanKey) || 0;
      const totalAfterScan = scannedQty + item.cantidad;

      if (totalAfterScan > orderLine.orderedQty) {
        throw new BadRequestException(
          `Excede lo pedido: ${item.codigo_producto} talla ${item.talla}. Pedido=${orderLine.orderedQty}, Escaneado=${scannedQty}, Intentando=${item.cantidad}`,
        );
      }

      inserts.push({
        id_pedido: dto.order_id,
        codigo_producto: item.codigo_producto,
        talla: item.talla,
        cantidad: item.cantidad,
      });
    }

    // ===============================
    // 5. Insert masivo
    // ===============================
    await escaneoRepo
      .createQueryBuilder()
      .insert()
      .into(Escaneo)
      .values(inserts)
      .execute();

    return {
      ok: true,
      order_id: dto.order_id,
      inserted_rows: inserts.length,
      total_quantity: inserts.reduce(
        (acc, item) => acc + Number(item.cantidad || 0),
        0,
      ),
    };
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

      const productIds = [
        ...new Set(
          details
            .map((d: any) => Number(d.product_id))
            .filter((id: number) => !isNaN(id))
        ),
      ];
      
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
          product_id: In(productIds),
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
      where: {
        id: In(productIds),
      },
      select: {
        id: true,
        article_code: true,
      },
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


