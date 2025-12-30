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
  ) {}

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

      const order = await orderRepo.findOne({ where: { id: dto.order_id } as any });
      if (!order) throw new NotFoundException('Pedido no encontrado');

      // ✅ validar estado aprobado
      if ((order as any).order_status_id !== 2) {
        throw new BadRequestException('Pedido no está aprobado');
      }

      const details = await detailRepo.find({ where: { order_id: dto.order_id } as any });
      if (!details.length) throw new BadRequestException('Pedido sin detalles');

      const products = await productRepo.find({
        where: { id: In((details as any[]).map((d) => d.product_id)) },
        select: ['id', 'article_code', 'article_description'] as any,
      } as any);
      const pMap = new Map(products.map((p: any) => [p.id, p]));

      let totalUnits = 0;
      let totalPrice = 0;

      const guia = guiaRepo.create({
        id_pedido: dto.order_id,
        cliente_id: (order as any).client_id,
        usuario_id: dto.usuario_id, // quien genera la guia (jefe u operador)
        proforma_number: (order as any).proforma_number,
        estado: 'Generada',
        observaciones: dto.observaciones ?? null,
      } as any);

      const guiaSaved = await guiaRepo.save(guia);

      for (const d of details as any[]) {
        const p = pMap.get(d.product_id);
        if (!p) throw new BadRequestException(`Producto no existe: ${d.product_id}`);

        const qty = Number(d.quantity);
        const unit = Number(d.unit_price);
        const lineTotal = Number((qty * unit).toFixed(2));

        totalUnits += qty;
        totalPrice += lineTotal;

        await guiaDetRepo.save(
          guiaDetRepo.create({
            id_guia_interna: (guiaSaved as any).id,
            producto_id: d.product_id,
            producto_codigo: p.article_code,
            producto_descripcion: p.article_description,
            producto_cantidad: qty,
            producto_precio_unitario: unit,
            producto_total: lineTotal,
          } as any),
        );
      }

      (guiaSaved as any).total_unidades = totalUnits;
      (guiaSaved as any).total_precio = Number(totalPrice.toFixed(2));
      await guiaRepo.save(guiaSaved);

      // ✅ crear estado de cuenta
      const estado = estadoCuentaRepo.create({
        cliente_id: (order as any).client_id,
        vendedor_id: (order as any).user_id, // vendedor que creó el pedido
        monto_inicial: (guiaSaved as any).total_precio,
        monto_pago: 0,
        monto_saldo: (guiaSaved as any).total_precio,
        id_guia_interna: (guiaSaved as any).id,
      } as any);

      const estadoSaved = await estadoCuentaRepo.save(estado);

      // ✅ vincular a Orders si tu tabla tiene estas columnas
      (order as any).id_guia_interna = (guiaSaved as any).id;
      await orderRepo.save(order);

      return { guia: guiaSaved, estadoCuenta: estadoSaved };
    });
  }
}
