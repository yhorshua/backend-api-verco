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
import { DeliveryStatusEnum } from './dto/statusDelivered.dto';


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

    const isDropshipping = dto.order_type === 'DROPSHIPPING';

    if (isDropshipping && !dto.payment_reference) {
      throw new BadRequestException('Debe enviar referencia de pago');
    }

    return this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(Order);
      const detailRepo = manager.getRepository(OrderDetail);
      const stockRepo = manager.getRepository(Stock);
      const reservationRepo = manager.getRepository(StockReservation);
      const productRepo = manager.getRepository(Product);

      // AGRUPAR ITEMS
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
      const lastOrder = await orderRepo.findOne({
        where: {}, // 👈 obligatorio
        order: { id: 'DESC' },
      });

      const nextProforma = (lastOrder?.proforma_number ?? 0) + 1;

      // CREAR ORDEN
      const order = orderRepo.create({
        proforma_number: nextProforma,
        client_id: dto.client_id,
        user_id: dto.user_id,
        warehouse_id: dto.warehouse_id,

        order_type: dto.order_type ?? 'NORMAL',

        payment_status: isDropshipping ? 'PAGADO' : 'PENDIENTE',
        payment_reference: dto.payment_reference ?? null,

        customer_name: dto.customer_name ?? null,
        customer_phone: dto.customer_phone ?? null,
        customer_address: dto.customer_address ?? null,
        customer_reference: dto.customer_reference ?? null,

        order_status_id: isDropshipping
          ? OrderStatusEnum.APROBADO
          : OrderStatusEnum.PENDIENTE,

        approval_date: isDropshipping ? new Date() : null,
      } as Partial<Order>);

      const savedOrder = await orderRepo.save(order as Order);

      const productIds = items.map((i) => i.product_id);

      const products = await productRepo.find({
        where: { id: In(productIds) },
      });

      const prodMap = new Map(products.map((p) => [p.id, p]));

      const stocks = await stockRepo.find({
        where: {
          warehouse_id: dto.warehouse_id,
          product_id: In(productIds),
        },
      });

      const stockMap = new Map(
        stocks.map((s) => [`${s.product_id}|${s.product_size_id ?? null}`, s]),
      );

      for (const it of items) {
        const product = prodMap.get(it.product_id);
        if (!product) throw new BadRequestException('Producto no existe');

        const key = `${it.product_id}|${it.product_size_id ?? null}`;
        const stock = stockMap.get(key);

        if (!stock) throw new BadRequestException('No hay stock');

        await stockRepo.findOne({
          where: { id: stock.id } as any,
          lock: { mode: 'pessimistic_write' },
        });

        // VALIDAR DISPONIBLE (sin reservas en dropshipping)
        let available = Number(stock.quantity);

        if (!isDropshipping) {
          const reservedAgg = await reservationRepo
            .createQueryBuilder('r')
            .select('COALESCE(SUM(r.quantity),0)', 'qty')
            .where('r.product_id = :p', { p: it.product_id })
            .andWhere(
              it.product_size_id
                ? 'r.product_size_id = :ps'
                : 'r.product_size_id IS NULL',
              { ps: it.product_size_id }
            )
            .andWhere('r.status = :st', {
              st: StockReservationStatus.RESERVADO,
            })
            .getRawOne();

          const reserved = Number(reservedAgg?.qty ?? 0);
          available -= reserved;
        }

        if (available < it.quantity) {
          throw new BadRequestException('Stock insuficiente');
        }

        // DETALLE
        await detailRepo.save({
          order_id: savedOrder.id,
          product_id: it.product_id,
          product_size_id: it.product_size_id ?? null,
          size: it.size,
          quantity: it.quantity,
          unit_price: it.unit_price,
          total_amount: it.quantity * Number(it.unit_price),
        });

        // RESERVA SOLO NORMAL
        if (!isDropshipping) {
          await reservationRepo.save({
            order_id: savedOrder.id,
            warehouse_id: dto.warehouse_id,
            product_id: it.product_id,
            product_size_id: it.product_size_id ?? null,
            quantity: it.quantity,
            status: StockReservationStatus.RESERVADO,
            created_by: dto.user_id,
          });
        }

        if (isDropshipping) {
          if (!dto.customer_name || !dto.customer_phone || !dto.customer_address) {
            throw new BadRequestException('Datos del cliente son obligatorios en dropshipping');
          }
          await reservationRepo.save({


            order_id: savedOrder.id,
            warehouse_id: dto.warehouse_id,
            product_id: it.product_id,
            product_size_id: it.product_size_id ?? null,
            quantity: it.quantity,
            status: StockReservationStatus.DIRECTO, // 🔥
            created_by: dto.user_id,
          });
        }
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
                    : o.order_status_id === OrderStatusEnum.GUIA_INTERNA_GENERADA
                      ? 'Guia Interna Generada'
                      : o.order_status_id === OrderStatusEnum.DESPACHADO
                        ? 'Despachado'
                        : o.order_status_id === OrderStatusEnum.FACTURADO
                          ? 'Facturado'
                          : o.order_status_id === OrderStatusEnum.CERRADO
                            ? 'Cerrado'
                            : 'Desconocido',
        totalUnidades,
        totalPrecio,
        items,
      };
    });
  }


  async markAsDelivered(orderId: number, userId: number, notes?: string) {
  const order = await this.orderRepo.findOne({ where: { id: orderId } });

  if (!order) throw new NotFoundException('Pedido no encontrado');

  if (order.order_status_id !== OrderStatusEnum.DESPACHADO) {
    throw new BadRequestException('Solo pedidos despachados pueden cerrarse');
  }

  order.order_status_id = OrderStatusEnum.CERRADO;
  order.delivered_at = new Date();

  order.delivered_by = userId;
  order.delivery_status = DeliveryStatusEnum.ENTREGADO;
  order.delivery_notes = notes ?? '';

  await this.orderRepo.save(order);

  return { ok: true };
}

}


