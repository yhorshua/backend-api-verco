import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository, Brackets } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { CreateGuiaInternaDto } from './dto/create-guia-interna.dto';

import { GuiaInterna } from '../database/entities/guia-interna.entity';
import { GuiaInternaDetalle } from '../database/entities/guia-interna-detalle.entity';
import {
  GuiaInternaDevolucion,
  GuiaDevolucionEstadoEnum,
} from '../database/entities/guia-interna-devolucion.entity';
import {
  GuiaInternaDevolucionDetalle,
  GuiaDevolucionDestinoEnum,
} from '../database/entities/guia-interna-devolucion-detalle.entity';
import { EstadoCuenta, EstadoCuentaEnum, TipoCreditoEnum } from '../database/entities/estado-cuenta.entity';
import { CreateGuiaDevolucionDto } from './dto/create-guia-devolucion.dto';
import { Stock } from '../database/entities/stock.entity';
import { StockMovement } from '../database/entities/stock-movements';
import { Order } from '../database/entities/orders.entity';
import { OrderDetail } from '../database/entities/order-details.entity';
import { Product } from '../database/entities/product.entity';
import { OrderStatusEnum } from 'src/orders/dto/orderStatusEnum';
import { GuiaEstadoEnum } from './dto/guia-estado.enum';
import { OrdersHistorial } from '../database/entities/orders-historial.entity';
import { EstadoCuentaHistorial } from '../database/entities/estado-cuenta-historial.entity';

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
    if (!dto.order_id) {
      throw new BadRequestException('order_id es requerido');
    }

    if (!dto.usuario_id) {
      throw new BadRequestException('usuario_id es requerido');
    }

    return this.dataSource.transaction(async (manager) => {
      const guiaRepo = manager.getRepository(GuiaInterna);
      const guiaDetRepo = manager.getRepository(GuiaInternaDetalle);
      const estadoCuentaRepo = manager.getRepository(EstadoCuenta);
      const orderRepo = manager.getRepository(Order);
      const detailRepo = manager.getRepository(OrderDetail);
      const historialRepo = manager.getRepository(OrdersHistorial);
      const estadoCuentaHistorialRepo =
        manager.getRepository(EstadoCuentaHistorial);

      /* ============================================================
         1. BLOQUEAR PEDIDO
      ============================================================ */
      const order = await orderRepo.findOne({
        where: { id: dto.order_id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) {
        throw new NotFoundException('Pedido no encontrado');
      }

      if (!order.client_id) {
        throw new BadRequestException('Pedido sin cliente');
      }

      if (!order.user_id) {
        throw new BadRequestException('Pedido sin vendedor');
      }

      /* ============================================================
         2. IDEMPOTENCIA
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
         3. VALIDAR FLUJO
      ============================================================ */
      if (order.order_status_id !== OrderStatusEnum.ALISTADO) {
        throw new BadRequestException(
          'Solo pedidos alistados pueden generar guía interna',
        );
      }

      const estadoAnterior = String(order.order_status_id);

      /* ============================================================
         4. OBTENER DETALLES DEL PEDIDO
         Importante:
         Usamos los datos ya guardados en Order_Details.
         Así no dependemos del precio actual de Products.
      ============================================================ */
      const details = await detailRepo.find({
        where: { order_id: dto.order_id },
      });

      if (!details.length) {
        throw new BadRequestException('Pedido sin detalles');
      }

      /* ============================================================
         5. CALCULAR TOTALES
      ============================================================ */
      let totalUnits = 0;
      let totalPrice = 0;

      for (const d of details) {
        const qty = Number(d.quantity || 0);
        const unit = Number(d.unit_price || 0);
        const total = Number((qty * unit).toFixed(2));

        if (qty <= 0) {
          throw new BadRequestException(
            `Cantidad inválida en el detalle ${d.id}`,
          );
        }

        if (unit < 0) {
          throw new BadRequestException(
            `Precio inválido en el detalle ${d.id}`,
          );
        }

        totalUnits += qty;
        totalPrice += total;
      }

      totalPrice = Number(totalPrice.toFixed(2));

      if (!totalPrice || totalPrice <= 0) {
        throw new BadRequestException('Total inválido');
      }

      /* ============================================================
         6. CREAR GUÍA
      ============================================================ */
      const guia = guiaRepo.create({
        id_pedido: dto.order_id,
        cliente_id: order.client_id,
        usuario_id: dto.usuario_id,
        proforma_number: order.proforma_number,
        estado: GuiaEstadoEnum.GENERADA,
        total_unidades: totalUnits,
        total_precio: totalPrice,
        observaciones: dto.observaciones ?? null,
      } as Partial<GuiaInterna>);

      const savedGuia = await guiaRepo.save(guia);

      /* ============================================================
         7. CREAR DETALLES DE GUÍA EN BLOQUE
      ============================================================ */
      const detallesToInsert = details.map((d) => {
        const qty = Number(d.quantity || 0);
        const unit = Number(d.unit_price || 0);
        const total = Number((qty * unit).toFixed(2));

        const factoryPrice = Number(
          (d as any).factory_price_at_order ?? 0,
        );

        const costoTotal = Number((qty * factoryPrice).toFixed(2));
        const utilidadTotal = Number((total - costoTotal).toFixed(2));

        return {
          id_guia_interna: savedGuia.id,

          order_detail_id: d.id ?? null,

          producto_id: d.product_id,
          product_size_id: d.product_size_id ?? null,
          talla: d.size ?? null,

          producto_codigo:
            (d as any).article_code_at_order ??
            '',

          producto_descripcion:
            (d as any).article_description_at_order ??
            '',

          producto_cantidad: qty,
          producto_precio_unitario: unit,

          factory_price_at_guide: factoryPrice,

          producto_total: total,
          costo_total: costoTotal,
          utilidad_total: utilidadTotal,
        };
      });

      await guiaDetRepo.insert(detallesToInsert);

      /* ============================================================
         8. CREAR ESTADO DE CUENTA
         Se deja PENDIENTE porque los pagos se cargarán después.
      ============================================================ */
      const fechaVencimiento =
        dto.tipo_credito === TipoCreditoEnum.CREDITO && dto.fecha_vencimiento
          ? new Date(dto.fecha_vencimiento)
          : null;

      const estado = estadoCuentaRepo.create({
        cliente_id: order.client_id,
        vendedor_id: order.user_id,

        monto_inicial: totalPrice,
        monto_pago: 0,
        monto_saldo: totalPrice,

        id_guia_interna: savedGuia.id,
        estado: EstadoCuentaEnum.PENDIENTE,

        tipo_credito: dto.tipo_credito ?? TipoCreditoEnum.CONTADO,
        fecha_vencimiento: fechaVencimiento,
        dias_credito: dto.dias_credito ?? null,
      } as Partial<EstadoCuenta>);

      const savedEstado = await estadoCuentaRepo.save(estado);

      /* ============================================================
         9. HISTORIAL DE ESTADO DE CUENTA
      ============================================================ */
      await estadoCuentaHistorialRepo.insert({
        id_estado_cuenta: savedEstado.id,
        monto_abono: 0,
        saldo_anterior: null,
        saldo_nuevo: totalPrice,
        usuario_id: dto.usuario_id,
      });

      /* ============================================================
         10. HISTORIAL DEL PEDIDO
      ============================================================ */
      await historialRepo.insert({
        id_pedido: order.id,
        estado_anterior: estadoAnterior,
        estado_nuevo: String(OrderStatusEnum.DESPACHADO),
        usuario_id: dto.usuario_id,
        observacion: `Guía interna generada: ${savedGuia.id}`,
      });

      /* ============================================================
         11. ACTUALIZAR PEDIDO
      ============================================================ */
      await orderRepo.update(
        { id: order.id },
        {
          id_guia_interna: savedGuia.id,
          order_status_id: OrderStatusEnum.DESPACHADO,
        },
      );

      return {
        ok: true,
        guia: {
          ...savedGuia,
          total_unidades: totalUnits,
          total_precio: totalPrice,
        },
        estadoCuenta: savedEstado,
      };
    });
  }

  async registrarDevolucionGuia(dto: CreateGuiaDevolucionDto) {
    if (!dto.id_guia_interna) {
      throw new BadRequestException('id_guia_interna es requerido');
    }

    if (!dto.usuario_id) {
      throw new BadRequestException('usuario_id es requerido');
    }

    if (!dto.items?.length) {
      throw new BadRequestException('Debe enviar al menos un producto a devolver');
    }

    return this.dataSource.transaction(async (manager) => {
      const guiaRepo = manager.getRepository(GuiaInterna);
      const guiaDetRepo = manager.getRepository(GuiaInternaDetalle);
      const devolucionRepo = manager.getRepository(GuiaInternaDevolucion);
      const devolucionDetRepo = manager.getRepository(GuiaInternaDevolucionDetalle);
      const orderRepo = manager.getRepository(Order);
      const estadoCuentaRepo = manager.getRepository(EstadoCuenta);
      const historialCuentaRepo = manager.getRepository(EstadoCuentaHistorial);
      const stockRepo = manager.getRepository(Stock);
      const stockMovementRepo = manager.getRepository(StockMovement);

      const guia = await guiaRepo.findOne({
        where: { id: dto.id_guia_interna },
        lock: { mode: 'pessimistic_write' },
      });

      if (!guia) {
        throw new NotFoundException('Guía interna no encontrada');
      }

      const order = await orderRepo.findOne({
        where: { id: guia.id_pedido },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) {
        throw new NotFoundException('Pedido relacionado no encontrado');
      }

      const estadoCuenta = await estadoCuentaRepo.findOne({
        where: { id_guia_interna: guia.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!estadoCuenta) {
        throw new NotFoundException('Estado de cuenta no encontrado para la guía');
      }

      const detalleIds = dto.items.map((i) => Number(i.id_guia_interna_detalle));

      const detallesGuia = await guiaDetRepo.find({
        where: {
          id: In(detalleIds),
          id_guia_interna: guia.id,
        } as any,
      });

      if (detallesGuia.length !== detalleIds.length) {
        throw new BadRequestException(
          'Uno o más detalles no pertenecen a la guía interna indicada',
        );
      }

      const detalleMap = new Map(detallesGuia.map((d) => [d.id, d]));

      const devolucionesPrevias = await devolucionDetRepo
        .createQueryBuilder('dd')
        .innerJoin(GuiaInternaDevolucion, 'dev', 'dev.id_devolucion = dd.id_devolucion')
        .select('dd.id_guia_interna_detalle', 'id_guia_interna_detalle')
        .addSelect('COALESCE(SUM(dd.cantidad), 0)', 'cantidad_devuelta')
        .where('dd.id_guia_interna_detalle IN (:...detalleIds)', { detalleIds })
        .andWhere("dev.estado <> 'ANULADA'")
        .groupBy('dd.id_guia_interna_detalle')
        .getRawMany();

      const devueltoMap = new Map<number, number>();

      for (const row of devolucionesPrevias) {
        devueltoMap.set(
          Number(row.id_guia_interna_detalle),
          Number(row.cantidad_devuelta || 0),
        );
      }

      let totalUnidades = 0;
      let totalImporte = 0;
      let totalCosto = 0;
      let totalUtilidadRevertida = 0;

      const itemsProcesados: Array<{
        detalleGuia: GuiaInternaDetalle;
        cantidad: number;
        precioUnitario: number;
        factoryPrice: number;
        total: number;
        costoTotal: number;
        utilidadRevertida: number;
        motivo: string | null;
        destino: GuiaDevolucionDestinoEnum;
        reingresaStock: boolean;
      }> = [];

      for (const item of dto.items) {
        const detalle = detalleMap.get(Number(item.id_guia_interna_detalle));

        if (!detalle) {
          throw new BadRequestException('Detalle de guía inválido');
        }

        const cantidad = Number(item.cantidad);
        const cantidadOriginal = Number(detalle.producto_cantidad || 0);
        const cantidadYaDevuelta = Number(devueltoMap.get(detalle.id) || 0);
        const cantidadDisponibleDevolver = cantidadOriginal - cantidadYaDevuelta;

        if (!Number.isFinite(cantidad) || cantidad <= 0) {
          throw new BadRequestException(
            `Cantidad inválida para detalle ${detalle.id}`,
          );
        }

        if (cantidad > cantidadDisponibleDevolver) {
          throw new BadRequestException(
            `No puedes devolver ${cantidad} unidades del detalle ${detalle.id}. Disponible para devolución: ${cantidadDisponibleDevolver}`,
          );
        }

        const precioUnitario = Number(detalle.producto_precio_unitario || 0);
        const factoryPrice = Number((detalle as any).factory_price_at_guide || 0);

        const total = Number((cantidad * precioUnitario).toFixed(2));
        const costoTotal = Number((cantidad * factoryPrice).toFixed(2));
        const utilidadRevertida = Number((total - costoTotal).toFixed(2));

        const destino = (
          item.destino ?? GuiaDevolucionDestinoEnum.STOCK_DISPONIBLE
        ) as GuiaDevolucionDestinoEnum;

        const reingresaStock =
          item.reingresa_stock !== undefined
            ? Boolean(item.reingresa_stock)
            : destino === GuiaDevolucionDestinoEnum.STOCK_DISPONIBLE;

        totalUnidades += cantidad;
        totalImporte += total;
        totalCosto += costoTotal;
        totalUtilidadRevertida += utilidadRevertida;

        itemsProcesados.push({
          detalleGuia: detalle,
          cantidad,
          precioUnitario,
          factoryPrice,
          total,
          costoTotal,
          utilidadRevertida,
          motivo: item.motivo ?? null,
          destino,
          reingresaStock,
        });
      }

      totalImporte = Number(totalImporte.toFixed(2));
      totalCosto = Number(totalCosto.toFixed(2));
      totalUtilidadRevertida = Number(totalUtilidadRevertida.toFixed(2));

      if (totalImporte <= 0) {
        throw new BadRequestException('El total de devolución es inválido');
      }

      const devolucion = devolucionRepo.create({
        id_guia_interna: guia.id,
        id_pedido: guia.id_pedido,
        cliente_id: guia.cliente_id,
        usuario_id: dto.usuario_id,
        warehouse_id: order.warehouse_id,

        motivo_general: dto.motivo_general ?? null,
        observacion: dto.observacion ?? null,

        total_unidades: totalUnidades,
        total_importe: totalImporte,
        total_costo: totalCosto,
        total_utilidad_revertida: totalUtilidadRevertida,

        estado: GuiaDevolucionEstadoEnum.REGISTRADA,
      } as Partial<GuiaInternaDevolucion>);

      const savedDevolucion = await devolucionRepo.save(devolucion);

      const detalleDevolucionToInsert: QueryDeepPartialEntity<GuiaInternaDevolucionDetalle>[] =
        itemsProcesados.map((item) => ({
          id_devolucion: savedDevolucion.id,

          id_guia_interna_detalle: item.detalleGuia.id,

          producto_id: item.detalleGuia.producto_id,
          product_size_id: (item.detalleGuia as any).product_size_id ?? null,
          talla: (item.detalleGuia as any).talla ?? null,

          cantidad: item.cantidad,
          precio_unitario: item.precioUnitario,
          factory_price_at_return: item.factoryPrice,

          total_importe: item.total,
          costo_total: item.costoTotal,
          utilidad_revertida: item.utilidadRevertida,

          motivo: item.motivo,
          destino: item.destino,
          reingresa_stock: item.reingresaStock,
        }));

      await devolucionDetRepo.insert(detalleDevolucionToInsert);

      const itemsParaStock = itemsProcesados.filter((i) => i.reingresaStock);

      if (itemsParaStock.length) {
        const groupedStock = new Map<
          string,
          {
            producto_id: number;
            product_size_id: number | null;
            cantidad: number;
          }
        >();

        for (const item of itemsParaStock) {
          const productId = item.detalleGuia.producto_id;
          const productSizeId = (item.detalleGuia as any).product_size_id ?? null;
          const key = `${productId}|${productSizeId ?? 'null'}`;

          const current = groupedStock.get(key);

          if (current) {
            current.cantidad += item.cantidad;
          } else {
            groupedStock.set(key, {
              producto_id: productId,
              product_size_id: productSizeId,
              cantidad: item.cantidad,
            });
          }
        }

        const stockItems = Array.from(groupedStock.values());

        const stocks = await stockRepo
          .createQueryBuilder('s')
          .where('s.warehouse_id = :warehouseId', {
            warehouseId: order.warehouse_id,
          })
          .andWhere(
            new Brackets((qb) => {
              stockItems.forEach((item, index) => {
                qb.orWhere(
                  `(s.product_id = :productId${index} AND s.product_size_id ${item.product_size_id === null
                    ? 'IS NULL'
                    : `= :productSizeId${index}`
                  })`,
                  {
                    [`productId${index}`]: item.producto_id,
                    [`productSizeId${index}`]: item.product_size_id,
                  },
                );
              });
            }),
          )
          .setLock('pessimistic_write')
          .getMany();

        const stockMap = new Map<string, Stock>();

        for (const stock of stocks) {
          const key = `${stock.product_id}|${stock.product_size_id ?? 'null'}`;
          stockMap.set(key, stock);
        }

        const stocksToSave: Stock[] = [];
        const movementsToSave: StockMovement[] = [];

        for (const item of stockItems) {
          const key = `${item.producto_id}|${item.product_size_id ?? 'null'}`;
          let stock = stockMap.get(key);

          const previousQuantity = stock ? Number(stock.quantity || 0) : 0;
          const newQuantity = Number((previousQuantity + item.cantidad).toFixed(2));

          if (stock) {
            stock.quantity = newQuantity;
          } else {
            stock = stockRepo.create({
              warehouse_id: order.warehouse_id,
              product_id: item.producto_id,
              product_size_id: item.product_size_id,
              unit_of_measure: 'PAR',
              quantity: newQuantity,
            });
          }

          stocksToSave.push(stock);

          movementsToSave.push(
            stockMovementRepo.create({
              warehouse_id: order.warehouse_id,
              product_id: item.producto_id,
              product_size_id: item.product_size_id,

              quantity: item.cantidad,
              previous_quantity: previousQuantity,
              new_quantity: newQuantity,

              unit_of_measure: 'PAR',
              movement_type: 'devolucion',

              reference_id: savedDevolucion.id,
              reference_type: 'DEVOLUCION_GUIA',
              reference: `DEV-GUIA-${savedDevolucion.id}`,

              notes: `Devolución de guía interna ${guia.id}. Stock anterior: ${previousQuantity}. Cantidad devuelta: ${item.cantidad}. Stock nuevo: ${newQuantity}.`,

              user_id: dto.usuario_id,
              created_at: new Date(),
            }),
          );
        }

        await stockRepo.save(stocksToSave);
        await stockMovementRepo.save(movementsToSave);
      }

      const saldoAnterior = Number(estadoCuenta.monto_saldo || 0);
      const montoInicial = Number(estadoCuenta.monto_inicial || 0);
      const montoPago = Number(estadoCuenta.monto_pago || 0);
      const montoDevolucionAnterior = Number(
        (estadoCuenta as any).monto_devolucion || 0,
      );

      const nuevoMontoDevolucion = Number(
        (montoDevolucionAnterior + totalImporte).toFixed(2),
      );

      const deudaNeta = Number((montoInicial - nuevoMontoDevolucion).toFixed(2));
      const saldoCalculado = Number((deudaNeta - montoPago).toFixed(2));

      const nuevoSaldo = saldoCalculado > 0 ? saldoCalculado : 0;
      const saldoFavor = saldoCalculado < 0 ? Math.abs(saldoCalculado) : 0;

      (estadoCuenta as any).monto_devolucion = nuevoMontoDevolucion;
      estadoCuenta.monto_saldo = nuevoSaldo;
      (estadoCuenta as any).monto_saldo_favor = saldoFavor;

      if (nuevoSaldo === 0) {
        estadoCuenta.estado = EstadoCuentaEnum.PAGADO;
      } else if (montoPago > 0) {
        estadoCuenta.estado = EstadoCuentaEnum.PARCIAL;
      } else {
        estadoCuenta.estado = EstadoCuentaEnum.PENDIENTE;
      }

      const savedEstadoCuenta = await estadoCuentaRepo.save(estadoCuenta);

      await historialCuentaRepo.insert({
        id_estado_cuenta: estadoCuenta.id,
        tipo_movimiento: 'DEVOLUCION',
        monto_abono: 0,
        monto_devolucion: totalImporte,
        saldo_anterior: saldoAnterior,
        saldo_nuevo: nuevoSaldo,
        referencia_tipo: 'DEVOLUCION_GUIA',
        referencia_id: savedDevolucion.id,
        observacion:
          dto.observacion ??
          `Devolución registrada desde guía interna ${guia.id}`,
        usuario_id: dto.usuario_id,
      } as any);

      return {
        ok: true,
        message: 'Devolución registrada correctamente',
        devolucion: savedDevolucion,
        resumen: {
          total_unidades: totalUnidades,
          total_importe: totalImporte,
          total_costo: totalCosto,
          total_utilidad_revertida: totalUtilidadRevertida,
          reingreso_stock: itemsParaStock.length > 0,
        },
        estadoCuenta: savedEstadoCuenta,
      };
    });
  }
}
