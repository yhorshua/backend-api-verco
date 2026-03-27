import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';

import { CreateOrderDto } from './dto/CreateOrderDto';
import { ListOrdersDto } from './dto/list-orders.dto';

import { Order } from '../database/entities/orders.entity';
import { OrderDetail } from '../database/entities/order-details.entity';
import { Stock } from '../database/entities/stock.entity';
import { InventoryMovement } from '../database/entities/inventory-movements.entity';
import { Product } from '../database/entities/product.entity';
import { StockReservation } from '../database/entities/stock_reservations.entity';
import { StockReservationStatus } from '../database/entities/stock-reservation-status.enum';
import { ListOrdersAdvancedDto } from './dto/list-orders-advanced.dto';
import { OrderStatusEnum } from './dto/orderStatusEnum';


@Injectable()
export class OrdersService {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,

    @InjectRepository(OrderDetail)
    private readonly orderDetailRepo: Repository<OrderDetail>,

    @InjectRepository(Stock)
    private readonly stockRepo: Repository<Stock>,

    @InjectRepository(InventoryMovement)
    private readonly movementRepo: Repository<InventoryMovement>,

    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    @InjectRepository(StockReservation)
    private readonly reservationRepo: Repository<StockReservation>,
  ) { }

  /* ============================================================
     CREAR PEDIDO + RESERVAR STOCK
     ============================================================ */
  async createOrderAndReserveStock(dto: CreateOrderDto) {
    if (!dto.items?.length) {
      throw new BadRequestException('items es requerido');
    }

    if (!dto.warehouse_id) {
      throw new BadRequestException('warehouse_id es requerido');
    }

    return this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(Order);
      const detailRepo = manager.getRepository(OrderDetail);
      const stockRepo = manager.getRepository(Stock);
      const reservationRepo = manager.getRepository(StockReservation);
      const productRepo = manager.getRepository(Product);

      /* ============================================================
         1️⃣ AGRUPAR ITEMS (evita duplicados)
      ============================================================ */
      const groupedItems = new Map<string, any>();

      for (const it of dto.items) {
        const key = `${it.product_id}|${it.product_size_id ?? null}`;

        if (!groupedItems.has(key)) {
          groupedItems.set(key, { ...it });
        } else {
          groupedItems.get(key).quantity += it.quantity;
        }
      }

      const items = Array.from(groupedItems.values());

      /* ============================================================
         2️⃣ CREAR PEDIDO
      ============================================================ */
      const order = orderRepo.create({
        proforma_number: Date.now(),
        client_id: dto.client_id,
        user_id: dto.user_id,
        warehouse_id: dto.warehouse_id,
        order_status_id: OrderStatusEnum.PENDIENTE, // CREATED
      });

      const savedOrder = await orderRepo.save(order);

      /* ============================================================
         3️⃣ TRAER PRODUCTOS
      ============================================================ */
      const productIds = items.map((i) => i.product_id);

      const products = await productRepo.find({
        where: { id: In(productIds) },
      });

      const prodMap = new Map(products.map((p) => [p.id, p]));

      /* ============================================================
         4️⃣ TRAER STOCK (1 sola consulta)
      ============================================================ */
      const stocks = await stockRepo.find({
        where: {
          warehouse_id: dto.warehouse_id,
          product_id: In(productIds),
        },
      });

      const stockMap = new Map(
        stocks.map(
          (s) => [`${s.product_id}|${s.product_size_id ?? null}`, s],
        ),
      );

      /* ============================================================
         5️⃣ VALIDAR + RESERVAR
      ============================================================ */
      for (const it of items) {
        const product = prodMap.get(it.product_id);

        if (!product) {
          throw new BadRequestException(
            `Producto no existe ${it.product_id}`,
          );
        }

        const key = `${it.product_id}|${it.product_size_id ?? null}`;
        const stock = stockMap.get(key);

        if (!stock) {
          throw new BadRequestException(
            `No hay stock para ${product.article_code}`,
          );
        }

        // 🔒 LOCK fila de stock (importante para concurrencia)
        await stockRepo.findOne({
          where: { id: stock.id } as any,
          lock: { mode: 'pessimistic_write' },
        });

        // 🔒 LOCK reservas también
        const reservedAgg = await reservationRepo
          .createQueryBuilder('r')
          .setLock('pessimistic_write')
          .select('COALESCE(SUM(r.quantity),0)', 'qty')
          .where('r.warehouse_id = :w', { w: dto.warehouse_id })
          .andWhere('r.product_id = :p', { p: it.product_id })
          .andWhere(
            it.product_size_id
              ? 'r.product_size_id = :s'
              : 'r.product_size_id IS NULL',
            { s: it.product_size_id },
          )
          .andWhere('r.status = :st', {
            st: StockReservationStatus.RESERVADO,
          })
          .getRawOne<{ qty: string }>();

        const reserved = Number(reservedAgg?.qty ?? 0);
        const available = Number(stock.quantity) - reserved;

        if (available < it.quantity) {
          throw new BadRequestException(
            `Stock insuficiente ${product.article_code}. Disponible ${available}`,
          );
        }

        /* ============================================================
           6️⃣ GUARDAR DETALLE
        ============================================================ */
        await detailRepo.save(
          detailRepo.create({
            order_id: savedOrder.id,
            product_id: it.product_id,
            product_size_id: it.product_size_id ?? null,
            size: it.size,
            quantity: it.quantity,
            unit_price: it.unit_price,
            total_amount: Number(
              (it.quantity * Number(it.unit_price)).toFixed(2),
            ),
          } as any),
        );

        /* ============================================================
           7️⃣ CREAR RESERVA
        ============================================================ */
        await reservationRepo.save(
          reservationRepo.create({
            order_id: savedOrder.id,
            warehouse_id: dto.warehouse_id,
            product_id: it.product_id,
            product_size_id: it.product_size_id ?? null,
            quantity: it.quantity,
            status: StockReservationStatus.RESERVADO,
            created_by: dto.user_id, // 🔥 auditoría
          }),
        );
      }

      return { order: savedOrder };
    });
  }

  /* ============================================================
     APROBAR PEDIDO
     ============================================================ */
  async approveOrder(orderId: number, approvedBy: number) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });

    if (!order) throw new NotFoundException('Pedido no encontrado');

    if (order.order_status_id !== OrderStatusEnum.PENDIENTE) {
      throw new BadRequestException('Solo pedidos pendientes pueden aprobarse');
    }
    order.order_status_id = OrderStatusEnum.APROBADO; // APROBADO
    order.approved_by = approvedBy;
    order.approval_date = new Date();

    await this.orderRepo.save(order);
    return { ok: true, order };
  }

  /* ============================================================
     RECHAZAR PEDIDO → LIBERAR RESERVA
     ============================================================ */
  async rejectOrder(orderId: number, rejectedBy: number, reason?: string) {
    return this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(Order);
      const reservationRepo = manager.getRepository(StockReservation);

      const order = await orderRepo.findOne({ where: { id: orderId } });
      if (!order) throw new NotFoundException('Pedido no encontrado');

      if (order.order_status_id !== OrderStatusEnum.PENDIENTE) {
        throw new BadRequestException('Solo pedidos pendientes pueden rechazarse');
      }

      await reservationRepo.update(
        {
          order_id: orderId,
          status: StockReservationStatus.RESERVADO,
        },
        {
          status: StockReservationStatus.LIBERADO,
        },
      );

      order.order_status_id = OrderStatusEnum.RECHAZADO; // RECHAZADO
      order.observations = reason ?? order.observations;
      await orderRepo.save(order);

      return { ok: true };
    });
  }

  /* ============================================================
     LISTAR / OBTENER
     ============================================================ */
  async listOrders(q: ListOrdersDto) {
    return this.orderRepo.find({
      where: {
        ...(q.status ? { order_status_id: Number(q.status) } : {}),
      } as any,
      order: { request_date: 'DESC' } as any,
    });
  }

  async getOrder(id: number) {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['user', 'client'],
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');

    const details = await this.orderDetailRepo.find({
      where: { order_id: id } as any,
      relations: ['product'],
    });

    // Mapear totales
    const totalUnidades = details.reduce((acc, d) => acc + d.quantity, 0);
    const totalPrecio = details.reduce(
      (acc, d) => acc + d.quantity * Number(d.unit_price),
      0
    );

    return { order, details, totalUnidades, totalPrecio };
  }

  async listOrdersByUserAndRole(dto: ListOrdersAdvancedDto) {
    const qb = this.orderRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.user', 'u')
      .leftJoinAndSelect('o.client', 'c')
      .leftJoinAndSelect('o.details', 'd')
      .leftJoinAndSelect('d.product', 'p')
      .orderBy('o.request_date', 'DESC');

    const role = dto.role?.toUpperCase();

    // Filtro por vendedor
    if (role === 'VENDEDOR') {
      qb.andWhere('o.user_id = :userId', { userId: dto.user_id });
    }

    // Filtros avanzados
    if (dto.client_id) qb.andWhere('o.client_id = :client', { client: dto.client_id });
    if (dto.seller_id) qb.andWhere('o.user_id = :seller', { seller: dto.seller_id });
    if (dto.status) qb.andWhere('o.order_status_id = :status', { status: dto.status });
    if (dto.date_from) qb.andWhere('o.request_date >= :from', { from: dto.date_from });
    if (dto.date_to) qb.andWhere('o.request_date <= :to', { to: dto.date_to });

    const orders = await qb.getMany();

    // Mapear los datos para frontend
    return orders.map((o) => {
      const totalUnidades = o.details?.reduce((acc, d) => acc + d.quantity, 0) || 0;
      const totalPrecio = o.details?.reduce(
        (acc, d) => acc + d.quantity * Number(d.unit_price),
        0
      ) || 0;

      const items = o.details?.map((d) => ({
        codigo: d.product?.article_code ?? '',
        descripcion: d.product?.article_description ?? '',
        serie: d.product?.series ?? '',
        precio: Number(d.unit_price),
        total: d.quantity,
        cantidades: { [d.size ?? 0]: d.quantity },
      })) || [];

      return {
        id: String(o.id),
        cliente: {
          codigo: o.client?.id ?? '',
          nombre: o.client?.business_name ?? '',
          ruc: o.client?.document_number ?? '',
          direccion: o.client?.address ?? '',
        },
        vendedor: o.user?.full_name ?? '',
        fechaRegistro: o.request_date?.toISOString().split('T')[0] ?? '',
        estado:
          o.order_status_id === OrderStatusEnum.PENDIENTE
            ? 'Pendiente'
            : o.order_status_id === OrderStatusEnum.APROBADO
              ? 'Aprobado'
              : o.order_status_id === OrderStatusEnum.RECHAZADO
                ? 'Rechazado'
                : o.order_status_id === OrderStatusEnum.EN_ALISTAMIENTO
                  ? 'En Alistamiento'
                  : o.order_status_id === OrderStatusEnum.ALISTADO
                    ? 'Alistado'
                    : o.order_status_id === OrderStatusEnum.FACTURADO
                      ? 'Facturado'
                      : 'Desconocido',
        totalUnidades,
        totalPrecio,
        items,
      };
    });
  }
}


