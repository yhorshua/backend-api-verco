/*import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CreateOrderDto } from './dto/CreateOrderDto';
import { Order } from './entities/orders.entity';
import { OrderDetail } from './entities/order-details.entity';
import { Stock } from '../products/entities/stock.entity';
import { InventoryMovements } from '../inventoryMovements/entities/inventory-movements.entity';
import { OrdersHistorial } from './entities/orders-historial.entity';
import { GuiaInterna } from './';
import { GuiaInternaDetails } from './entities/guia-interna-details.entity';
import { Client } from '../clients/entity/client.entity';
import { Product } from '../products/entities/product.entity';

@Injectable()
export class OrdersService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}


  async create(dto: CreateOrderDto, sellerId: number) {
    return this.dataSource.transaction(async manager => {
      const orderRepo = manager.getRepository(Order);
      const odRepo = manager.getRepository(OrderDetail);
      const stockRepo = manager.getRepository(Stock);
      const moveRepo = manager.getRepository(InventoryMovements);
      const histRepo = manager.getRepository(OrdersHistorial);

      // Cabecera
      const order = await orderRepo.save({
        proforma_number: dto.proforma_number,
        client_id: dto.client_id,
        user_id: sellerId,
        warehouse_id: dto.warehouse_id,
        order_status_id: 1, // SOLICITADO
        observations: dto.observations,
      });

      // Detalles y reserva de stock
      for (const d of dto.details) {
        await odRepo.save({
          order_id: order.id,
          product_id: d.product_id,
          product_size_id: d.product_size_id ?? null,
          size: d.size,
          quantity: d.quantity,
          unit_price: d.unit_price,
          total_amount: Number(d.unit_price) * Number(d.quantity),
        });

        const stock = await stockRepo.findOne({
          where: {
            warehouse_id: dto.warehouse_id,
            product_id: d.product_id,
            product_size_id: d.product_size_id ?? null,
          },
          lock: { mode: 'pessimistic_write' },
        });

        if (!stock || Number(stock.quantity) < Number(d.quantity)) {
          throw new Error('Stock insuficiente');
        }

        stock.quantity = Number(stock.quantity) - Number(d.quantity);
        await stockRepo.save(stock);

        await moveRepo.save({
          product_id: d.product_id,
          product_size_id: d.product_size_id ?? null,
          warehouse_id: dto.warehouse_id,
          movement_type: 'SALIDA_RESERVA',
          reference_id: order.id,
          quantity: d.quantity,
          unit_of_measure: stock.unit_of_measure,
          remarks: 'Salida por creación de pedido',
          user_id: sellerId,
        });
      }

      await histRepo.save({
        id_pedido: order.id,
        estado_anterior: null,
        estado_nuevo: 'SOLICITADO',
        usuario_id: sellerId,
      });

      return orderRepo.findOne({
        where: { id: order.id },
        relations: ['client', 'seller', 'warehouse', 'status'],
      });
    });
  }


  async approve(orderId: number, approverId: number) {
    return this.dataSource.transaction(async manager => {
      const order = await manager.getRepository(Order).findOne({ where: { id: orderId } });
      if (!order || order.order_status_id !== 1) {
        throw new Error('Pedido no está en SOLICITADO');
      }

      await manager.getRepository(Order).update(orderId, {
        order_status_id: 3, // AUTORIZADO
        approved_by: approverId,
        approval_date: new Date(),
      });

      await manager.getRepository(OrdersHistorial).save({
        id_pedido: orderId,
        estado_anterior: 'SOLICITADO',
        estado_nuevo: 'AUTORIZADO',
        usuario_id: approverId,
      });

      return order;
    });
  }

 
  async reject(orderId: number, approverId: number) {
    return this.dataSource.transaction(async manager => {
      const orderRepo = manager.getRepository(Order);
      const odRepo = manager.getRepository(OrderDetail);
      const stockRepo = manager.getRepository(Stock);
      const moveRepo = manager.getRepository(InventoryMovements);
      const histRepo = manager.getRepository(OrdersHistorial);

      const order = await orderRepo.findOne({ where: { id: orderId } });
      if (!order || order.order_status_id !== 1) {
        throw new Error('Pedido no está en SOLICITADO');
      }

      const details = await odRepo.find({ where: { order_id: orderId } });
      for (const d of details) {
        const stock = await stockRepo.findOne({
          where: {
            warehouse_id: order.warehouse_id,
            product_id: d.product_id,
            product_size_id: d.product_size_id ?? null,
          },
          lock: { mode: 'pessimistic_write' },
        });

        stock.quantity = Number(stock.quantity) + Number(d.quantity);
        await stockRepo.save(stock);

        await moveRepo.save({
          product_id: d.product_id,
          product_size_id: d.product_size_id ?? null,
          warehouse_id: order.warehouse_id,
          movement_type: 'ENTRADA_RECHAZO',
          reference_id: order.id,
          quantity: d.quantity,
          unit_of_measure: stock.unit_of_measure,
          remarks: 'Retorno por rechazo de pedido',
          user_id: approverId,
        });
      }

      await orderRepo.update(orderId, { order_status_id: 2 }); // RECHAZADO
      await histRepo.save({
        id_pedido: orderId,
        estado_anterior: 'SOLICITADO',
        estado_nuevo: 'RECHAZADO',
        usuario_id: approverId,
      });

      return order;
    });
  }


  async generateInternalGuide(orderId: number, userId: number) {
    return this.dataSource.transaction(async manager => {
      const orderRepo = manager.getRepository(Order);
      const odRepo = manager.getRepository(OrderDetail);
      const giRepo = manager.getRepository(GuiaInterna);
      const gidRepo = manager.getRepository(GuiaInternaDetails);
      const histRepo = manager.getRepository(OrdersHistorial);

      const order = await orderRepo.findOne({ where: { id: orderId } });
      if (!order || order.order_status_id !== 3) {
        throw new Error('Pedido no autorizado');
      }

      const details = await odRepo.find({ where: { order_id: orderId } });
      const totals = details.reduce(
        (a, d) => ({
          unidades: a.unidades + d.quantity,
          precio: a.precio + Number(d.total_amount),
        }),
        { unidades: 0, precio: 0 },
      );

      const client = await manager.getRepository(Client).findOne({ where: { id: order.client_id } });

      const gi = await giRepo.save({
        id_pedido: orderId,
        cliente_id: order.client_id,
        cliente_nombre: client.business_name,
        usuario_id: userId,
        estado: 'GENERADA',
        proforma_number: order.proforma_number,
        total_unidades: totals.unidades,
        total_precio: totals.precio,
        observaciones: order.observations,
      });

      for (const d of details) {
        const product = await manager.getRepository(Product).findOne({ where: { id: d.product_id } });
        await gidRepo.save({
          id_guia_interna: gi.id_guia_interna,
          product_id: d.product_id,
          product_size_id: d.product_size_id ?? null,
          producto_codigo: product.article_code,
          producto_descripcion: product.article_description,
          producto_cantidad: d.quantity,
          producto_precio_unitario: d.unit_price,
          producto_total: d.total_amount,
        });
      }

      await orderRepo.update(orderId, {
        id_guia_interna: gi.id_guia_interna,
        order_status_id: 4, // GUIA_INTERNA_GENERADA
      });

      await histRepo.save({
        id_pedido: orderId,
        estado_anterior: 'AUTORIZADO',
        estado_nuevo: 'GUIA_INTERNA_GENERADA',
        usuario_id: userId,
      });

      return gi;
    });
  }
} */