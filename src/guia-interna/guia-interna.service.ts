import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';

import { CreateGuiaInternaDto } from './dto/create-guia-interna.dto';

import { GuiaInterna } from '../database/entities/guia-interna.entity';
import { GuiaInternaDetalle } from '../database/entities/guia-interna-detalle.entity';
import { EstadoCuenta } from '../database/entities/estado-cuenta.entity';

import { Order } from '../database/entities/orders.entity';
import { OrderDetail } from '../database/entities/order-details.entity';
import { Product } from '../database/entities/product.entity';
import { OrderStatusEnum } from 'src/orders/dto/orderStatusEnum';
import { GuiaEstadoEnum } from './dto/guia-estado.enum';

@Injectable()
export class GuiaInternaService {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(GuiaInterna)
    private readonly guiaRepo: Repository<GuiaInterna>,

    @InjectRepository(GuiaInternaDetalle)
    private readonly guiaDetRepo: Repository<GuiaInternaDetalle>,

    @InjectRepository(EstadoCuenta)
    private readonly estadoCuentaRepo: Repository<EstadoCuenta>,

    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,

    @InjectRepository(OrderDetail)
    private readonly orderDetailRepo: Repository<OrderDetail>,

    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) { }

  async createFromOrder(dto: CreateGuiaInternaDto) {
    if (!dto.order_id) throw new BadRequestException('order_id es requerido');
    if (!dto.usuario_id) throw new BadRequestException('usuario_id es requerido');

    return this.dataSource.transaction(async (manager) => {
      const guiaRepo = manager.getRepository(GuiaInterna);
      const guiaDetRepo = manager.getRepository(GuiaInternaDetalle);
      const estadoCuentaRepo = manager.getRepository(EstadoCuenta);
      const orderRepo = manager.getRepository(Order);
      const detailRepo = manager.getRepository(OrderDetail);
      const productRepo = manager.getRepository(Product);

      /* ============================================================
         1️ LOCK PEDIDO
      ============================================================ */
      const order = await orderRepo.findOne({
        where: { id: dto.order_id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) throw new NotFoundException('Pedido no encontrado');

      if (!order.client_id) throw new BadRequestException('Pedido sin cliente');
      if (!order.user_id) throw new BadRequestException('Pedido sin vendedor');

      /* ============================================================
         2️ IDEMPOTENCIA
      ============================================================ */
      const existingGuide = await guiaRepo.findOne({
        where: { id_pedido: dto.order_id },
      });

      if (existingGuide) {
        return {
          ok: true,
          message: 'Guía ya generada',
          guia: existingGuide,
        };
      }

      /* ============================================================
         3️ VALIDACIÓN FLUJO
      ============================================================ */
      if (order.order_status_id !== OrderStatusEnum.ALISTADO) {
        throw new BadRequestException(
          'Solo pedidos alistados pueden generar guía interna',
        );
      }

      /* ============================================================
         4️ OBTENER DETALLES
      ============================================================ */
      const details = await detailRepo.find({
        where: { order_id: dto.order_id },
      });

      if (!details.length) {
        throw new BadRequestException('Pedido sin detalles');
      }

      const products = await productRepo.find({
        where: { id: In(details.map((d) => d.product_id)) },
        select: ['id', 'article_code', 'article_description'],
      });

      const pMap = new Map(products.map((p) => [p.id, p]));

      /* ============================================================
         5️ CREAR GUIA
      ============================================================ */
      let totalUnits = 0;
      let totalPrice = 0;

      const guia = guiaRepo.create({
        id_pedido: dto.order_id,
        cliente_id: order.client_id,
        usuario_id: dto.usuario_id,
        proforma_number: order.proforma_number,
        estado: GuiaEstadoEnum.GENERADA,
      });

      await guiaRepo.save(guia);

      /* ============================================================
         6️ CREAR DETALLES ( FIX CLAVE)
      ============================================================ */
      const detalles: GuiaInternaDetalle[] = [];

      for (const d of details) {
        const p = pMap.get(d.product_id);
        if (!p) throw new BadRequestException('Producto inválido');

        const qty = Number(d.quantity);
        const unit = Number(d.unit_price);
        const total = Number((qty * unit).toFixed(2));

        totalUnits += qty;
        totalPrice += total;

        const detalle = guiaDetRepo.create({
          id_guia_interna: guia.id, // 🔥 CLAVE
          producto_id: d.product_id,
          producto_codigo: p.article_code,
          producto_descripcion: p.article_description,
          producto_cantidad: qty,
          producto_precio_unitario: unit,
          producto_total: total,
        });

        detalles.push(detalle);
      }

      // 🔥 guardado masivo (PRO)
      await guiaDetRepo.save(detalles);

      /* ============================================================
         7️ TOTALES
      ============================================================ */
      guia.total_unidades = totalUnits;
      guia.total_precio = Number(totalPrice.toFixed(2));

      if (!guia.total_precio || guia.total_precio <= 0) {
        throw new BadRequestException('Total inválido');
      }

      await guiaRepo.save(guia);

      /* ============================================================
         8️ ESTADO DE CUENTA
      ============================================================ */
      let estado = await estadoCuentaRepo.findOne({
        where: { id_guia_interna: guia.id },
      });

      if (!estado) {
        estado = await estadoCuentaRepo.save(
          estadoCuentaRepo.create({
            cliente_id: order.client_id,
            vendedor_id: order.user_id,
            monto_inicial: guia.total_precio,
            monto_pago: 0,
            monto_saldo: guia.total_precio,
            id_guia_interna: guia.id,
          }),
        );
      }

      /* ============================================================
         9 CAMBIO DE ESTADO FINAL
      ============================================================ */
      order.order_status_id = OrderStatusEnum.DESPACHADO;
      await orderRepo.save(order);

      /* ============================================================
          RESPONSE
      ============================================================ */
      return {
        ok: true,
        guia,
        estadoCuenta: estado,
      };
    });
  }
}
