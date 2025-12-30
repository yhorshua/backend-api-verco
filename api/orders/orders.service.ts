import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';

import { CreateOrderDto } from './dto/CreateOrderDto';
import { ListOrdersDto } from './dto/list-orders.dto';

import { Order } from '../database/entities/orders.entity';
import { OrderDetail } from '../database/entities/order-details.entity';
import { Stock } from '../database/entities/stock.entity';
import { InventoryMovement } from '../database/entities/inventory-movements.entity';
import { Product } from '../database/entities/product.entity';

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
  ) { }

  async createOrderAndReserveStock(dto: CreateOrderDto) {
    if (!dto.items?.length) throw new BadRequestException('items es requerido');
    if (!dto.warehouse_id) throw new BadRequestException('warehouse_id es requerido');

    return this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(Order);
      const detailRepo = manager.getRepository(OrderDetail);
      const stockRepo = manager.getRepository(Stock);
      const movementRepo = manager.getRepository(InventoryMovement);
      const productRepo = manager.getRepository(Product);

      // 1) Crear Order
      const order = this.orderRepo.create({
        proforma_number: Date.now(),
        client_id: dto.client_id,
        user_id: dto.user_id,
        order_status_id: 1,
        // observations se arregla abajo
        warehouse_id: dto.warehouse_id,
      });

      const savedOrder = await orderRepo.save(order);

      // 2) Traer productos para validar
      const productIds = dto.items.map((i) => i.product_id);
      const products = await productRepo.find({ where: { id: In(productIds) } });
      const prodMap = new Map(products.map((p) => [p.id, p]));

      // 3) Validar y descontar stock por item
      for (const it of dto.items) {
        const p = prodMap.get(it.product_id);
        if (!p) throw new BadRequestException(`Producto no existe: ${it.product_id}`);

        // 🔒 Row lock (solo funciona bien si tu motor soporta lock en la transacción)
        const stock = await stockRepo.findOne({
          where: {
            warehouse_id: dto.warehouse_id,
            product_id: it.product_id,
            product_size_id: it.product_size_id ?? null,
          } as any,
          lock: { mode: 'pessimistic_write' },
        });

        if (!stock) {
          throw new BadRequestException(
            `No hay stock para producto ${p.article_code} talla ${it.size}`,
          );
        }

        const available = Number(stock.quantity);
        const needed = Number(it.quantity);

        if (!Number.isFinite(needed) || needed <= 0) {
          throw new BadRequestException(`Cantidad inválida para ${p.article_code}`);
        }

        if (available < needed) {
          throw new BadRequestException(
            `Stock insuficiente ${p.article_code} (${it.size}). Disponible ${available}, pedido ${needed}`,
          );
        }

        // descontar stock
        stock.quantity = Number((available - needed).toFixed(2));
        await stockRepo.save(stock);

        // detalle pedido
        const detail = detailRepo.create({
          order_id: savedOrder.id,
          product_id: it.product_id,
          product_size_id: it.product_size_id ?? null,
          size: it.size,
          quantity: needed,
          unit_price: it.unit_price,
          total_amount: Number((needed * Number(it.unit_price)).toFixed(2)),
        } as any);

        await detailRepo.save(detail);

        // movimiento
        const mov = movementRepo.create({
          product_id: it.product_id,
          product_size_id: it.product_size_id ?? null,
          warehouse_id: dto.warehouse_id,
          movement_type: 'salida_pedido',
          reference_id: savedOrder.id,
          quantity: needed,
          unit_of_measure: 'UND',
          remarks: `Pedido #${savedOrder.proforma_number}`,
          user_id: dto.user_id,
        } as any);

        await movementRepo.save(mov);
      }

      return { order: savedOrder };
    });
  }

  async listOrders(q: ListOrdersDto) {
    return this.orderRepo.find({
      where: {
        // ✅ recomendado si agregas warehouse_id en Orders
        // warehouse_id: q.warehouseId,
        ...(q.status ? { order_status_id: Number(q.status) } : {}),
      } as any,
      order: { request_date: 'DESC' } as any,
      relations: { client: true, user: true, status: true } as any,
    });
  }

  async getOrder(id: number) {
    const order = await this.orderRepo.findOne({
      where: { id } as any,
      relations: { client: true, user: true, status: true, approvedByUser: true } as any,
    });

    if (!order) throw new NotFoundException('Pedido no encontrado');

    const details = await this.orderDetailRepo.find({ where: { order_id: id } as any });
    return { order, details };
  }

  async approveOrder(orderId: number, approvedBy: number) {
    return this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(Order);

      const order = await orderRepo.findOne({ where: { id: orderId } as any });
      if (!order) throw new NotFoundException('Pedido no encontrado');

      order.order_status_id = 2; // APPROVED
      order.approved_by = approvedBy;
      order.approval_date = new Date();

      await orderRepo.save(order);

      return { ok: true, order };
    });
  }

  async rejectOrder(orderId: number, rejectedBy: number, reason?: string) {
    return this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(Order);
      const detailRepo = manager.getRepository(OrderDetail);
      const stockRepo = manager.getRepository(Stock);
      const movementRepo = manager.getRepository(InventoryMovement);
      const productRepo = manager.getRepository(Product);

      const order = await orderRepo.findOne({ where: { id: orderId } as any });
      if (!order) throw new NotFoundException('Pedido no encontrado');

      const details = await detailRepo.find({ where: { order_id: orderId } as any });
      if (!details.length) throw new BadRequestException('Pedido sin detalles');

      // Necesitamos warehouse_id para revertir stock
      const warehouseId = (order as any).warehouse_id;
      if (!warehouseId) {
        // Si aún no lo tienes en Orders, tu única opción es recibirlo por dto o inferirlo (NO recomendado)
        throw new BadRequestException('Orders.warehouse_id es requerido para revertir stock');
      }

      const products = await productRepo.find({
        where: { id: In(details.map((d) => d.product_id)) },
      });
      const prodMap = new Map(products.map((p) => [p.id, p]));

      for (const d of details as any[]) {
        const p = prodMap.get(d.product_id);

        const stock = await stockRepo.findOne({
          where: {
            warehouse_id: warehouseId,
            product_id: d.product_id,
            product_size_id: d.product_size_id ?? null,
          } as any,
          lock: { mode: 'pessimistic_write' },
        });

        if (!stock) {
          throw new BadRequestException(
            `Stock row no existe para reversa (producto ${p?.article_code ?? d.product_id})`,
          );
        }

        stock.quantity = Number((Number(stock.quantity) + Number(d.quantity)).toFixed(2));
        await stockRepo.save(stock);

        await movementRepo.save(
          movementRepo.create({
            product_id: d.product_id,
            product_size_id: d.product_size_id ?? null,
            warehouse_id: warehouseId,
            movement_type: 'entrada_reversion',
            reference_id: orderId,
            quantity: Number(d.quantity),
            unit_of_measure: 'UND',
            remarks: `Rechazo pedido #${order.proforma_number}. ${reason ?? ''}`,
            user_id: rejectedBy,
          } as any),
        );
      }

      order.order_status_id = 3; // REJECTED
      order.observations = reason ?? (order as any).observations;

      await orderRepo.save(order);

      return { ok: true, order };
    });
  }
}
