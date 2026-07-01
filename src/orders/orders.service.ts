import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
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
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DASHBOARD_EVENTS } from '../dashCounter/dto/dashboard-events.constants';


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

    private readonly eventEmitter: EventEmitter2,
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

    const result = await this.dataSource.transaction(async (manager) => {
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

    this.eventEmitter.emit('order.created', {
      message: 'Nuevo pedido registrado',
      proforma: result.order.proforma_number,
      customerName: result.order.customer_name ?? 'Cliente no especificado',
    });

    return result;

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

  async listOrdersByUserAndRole(
    dto: ListOrdersAdvancedDto,
    userId: number,
    role: string,
  ) {

    const qb = this.orderRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.user', 'u')
      .leftJoinAndSelect('o.client', 'c')
      .leftJoinAndSelect('o.details', 'd')
      .leftJoinAndSelect('d.product', 'p')
      .orderBy('o.request_date', 'DESC');

    // =========================================
    // VALIDACIÓN POR ROL
    // =========================================

    switch (role) {
      case 'Vendedor':
        qb.andWhere('o.user_id = :userId', {
          userId,
        });
        break;

      case 'Vendedor Web':
        qb.andWhere('o.user_id = :userId', {
          userId,
        });
        break;

      case 'Jefe Ventas':
      case 'Administrador':
      case 'Almacenero':
        // Ve todos los pedidos
        break;

      default:
        throw new UnauthorizedException(
          'No tiene permisos para consultar pedidos',
        );
    }

    // =========================================
    // FILTROS
    // =========================================

    if (dto.client_id) {
      qb.andWhere('o.client_id = :client', {
        client: dto.client_id,
      });
    }

    // Solo jefe/administrador pueden filtrar vendedor
    if (
      dto.seller_id &&
      ['Administrador', 'Jefe Ventas'].includes(role)
    ) {
      qb.andWhere('o.user_id = :seller', {
        seller: dto.seller_id,
      });
    }

    if (dto.status) {
      qb.andWhere('o.order_status_id = :status', {
        status: dto.status,
      });
    }

    if (dto.date_from) {
      qb.andWhere('o.request_date >= :from', {
        from: dto.date_from,
      });
    }

    if (dto.date_to) {
      qb.andWhere('o.request_date <= :to', {
        to: dto.date_to,
      });
    }

    const orders = await qb.getMany();

    return orders.map((o) => {
      const totalUnidades =
        o.details?.reduce(
          (acc, d) => acc + d.quantity,
          0,
        ) || 0;

      const totalPrecio =
        o.details?.reduce(
          (acc, d) =>
            acc + d.quantity * Number(d.unit_price),
          0,
        ) || 0;

      const items =
        o.details?.map((d) => ({
          codigo:
            d.product?.article_code ?? '',

          descripcion:
            d.product?.article_description ?? '',

          serie:
            d.product?.series ?? '',

          precio:
            Number(d.unit_price),

          total:
            d.quantity,

          cantidades: {
            [d.size ?? 0]:
              d.quantity,
          },
        })) || [];

      return {
        id: String(o.id),

        cliente: {
          codigo:
            o.client?.id ?? '',

          nombre:
            o.client?.business_name ?? '',

          ruc:
            o.client?.document_number ?? '',

          direccion:
            o.client?.address ?? '',
        },

        vendedor:
          o.user?.full_name ?? '',

        vendedorId:
          o.user?.id ?? null,

        fechaRegistro:
          o.request_date
            ?.toISOString()
            .split('T')[0] ?? '',

        estado:
          o.order_status_id === OrderStatusEnum.PENDIENTE
            ? 'Pendiente'
            : o.order_status_id ===
              OrderStatusEnum.APROBADO
              ? 'Aprobado'
              : o.order_status_id ===
                OrderStatusEnum.RECHAZADO
                ? 'Rechazado'
                : o.order_status_id ===
                  OrderStatusEnum.EN_ALISTAMIENTO
                  ? 'En Alistamiento'
                  : o.order_status_id ===
                    OrderStatusEnum.ALISTADO
                    ? 'Alistado'
                    : o.order_status_id ===
                      OrderStatusEnum.DESPACHADO
                      ? 'Despachado'
                      : o.order_status_id ===
                        OrderStatusEnum.GUIA_INTERNA_GENERADA
                        ? 'Guia Interna Generada'
                        : o.order_status_id ===
                          OrderStatusEnum.FACTURADO
                          ? 'Facturado'
                          : o.order_status_id ===
                            OrderStatusEnum.CERRADO
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

  async getSalesReport(dto: {
  fecha_inicio?: string;
  fecha_fin?: string;
  vendedor_id?: number;
}) {
  const qb = this.orderRepo
    .createQueryBuilder('o')
    .leftJoinAndSelect('o.user', 'u')
    .leftJoinAndSelect('o.client', 'c')
    .leftJoinAndSelect('o.details', 'd')
    .leftJoinAndSelect('d.product', 'p')
    .where('1 = 1');

  if (dto.fecha_inicio) {
    qb.andWhere('DATE(o.request_date) >= :fecha_inicio', {
      fecha_inicio: dto.fecha_inicio,
    });
  }

  if (dto.fecha_fin) {
    qb.andWhere('DATE(o.request_date) <= :fecha_fin', {
      fecha_fin: dto.fecha_fin,
    });
  }

  if (dto.vendedor_id) {
    qb.andWhere('o.user_id = :vendedor_id', {
      vendedor_id: dto.vendedor_id,
    });
  }

  qb.orderBy('o.request_date', 'DESC');

  const orders = await qb.getMany();

  const resumenGeneral = {
    total_pedidos: 0,
    pedidos_pendientes: 0,
    pedidos_aprobados: 0,
    pedidos_despachados: 0,
    pedidos_entregados: 0,
    pedidos_cancelados: 0,

    total_importe_registrado: 0,
    total_importe_vendido: 0,
    total_importe_pendiente: 0,
    total_importe_devuelto: 0,

    total_costo_compra: 0,
    total_utilidad: 0,
    margen_utilidad_porcentaje: 0,

    total_pares_registrados: 0,
    total_pares_vendidos: 0,
    total_pares_pendientes: 0,
    total_pares_devueltos: 0,
  };

  const vendedoresMap = new Map<number, any>();
  const productosMap = new Map<number, any>();
  const tallasMap = new Map<string, any>();

 const detalleVentas: any[] = [];

  const getEstadoPedido = (statusId: number) => {
    switch (statusId) {
      case OrderStatusEnum.PENDIENTE:
        return 'PENDIENTE';
      case OrderStatusEnum.APROBADO:
        return 'APROBADO';
      case OrderStatusEnum.DESPACHADO:
        return 'DESPACHADO';
      case OrderStatusEnum.CERRADO:
        return 'ENTREGADO';
      case OrderStatusEnum.RECHAZADO:
        return 'CANCELADO';
      default:
        return 'OTRO';
    }
  };

  for (const order of orders) {
    const estadoPedido = getEstadoPedido(order.order_status_id);

    let totalImporteRegistrado = 0;
    let totalImporteVendido = 0;
    let totalImportePendiente = 0;
    let totalImporteDevuelto = 0;

    let totalCostoCompra = 0;
    let totalUtilidad = 0;

    let totalParesRegistrados = 0;
    let totalParesVendidos = 0;
    let totalParesPendientes = 0;
    let totalParesDevueltos = 0;

    const detalles: any[] = [];

    for (const d of order.details || []) {
      const cantidad = Number(d.quantity || 0);
      const precioVenta = Number(d.unit_price || 0);

  
      const precioCompra = Number(d.product?.factory_price || 0);

      const subtotalRegistrado = cantidad * precioVenta;
      const costoCompraTotal = cantidad * precioCompra;

      const esVendido = estadoPedido === 'DESPACHADO';
      const esPendiente = ['PENDIENTE', 'APROBADO', 'DESPACHADO'].includes(estadoPedido);
      const esDevuelto = estadoPedido === 'CANCELADO';

      const importeFinal = esVendido ? subtotalRegistrado : 0;
      const utilidad = esVendido ? importeFinal - costoCompraTotal : 0;

      totalImporteRegistrado += subtotalRegistrado;
      totalParesRegistrados += cantidad;

      if (esVendido) {
        totalImporteVendido += subtotalRegistrado;
        totalCostoCompra += costoCompraTotal;
        totalUtilidad += utilidad;
        totalParesVendidos += cantidad;
      }

      if (esPendiente) {
        totalImportePendiente += subtotalRegistrado;
        totalParesPendientes += cantidad;
      }

      if (esDevuelto) {
        totalImporteDevuelto += subtotalRegistrado;
        totalParesDevueltos += cantidad;
      }

      const detalle = {
        detalle_id: d.id,
        estado_detalle: esDevuelto ? 'DEVUELTO' : esVendido ? 'VENDIDO' : 'PENDIENTE',

        product_id: d.product_id,
        product_size_id: d.product_size_id,

        article_code: d.product?.article_code ?? '',
        article_description: d.product?.article_description ?? '',
        brand_name: (d.product as any)?.brand_name ?? '',
        model_code: (d.product as any)?.model_code ?? '',
        color: (d.product as any)?.color ?? '',

        talla: d.size,
        cantidad_pares: cantidad,

        precio_compra_unitario: precioCompra,
        precio_venta_unitario: precioVenta,

        subtotal_registrado: subtotalRegistrado,
        importe_final: importeFinal,
        costo_compra_total: esVendido ? costoCompraTotal : 0,
        utilidad,
        margen_utilidad_porcentaje:
          importeFinal > 0 ? Number(((utilidad / importeFinal) * 100).toFixed(2)) : 0,

        vendido: esVendido,
        pendiente: esPendiente,
        devuelto: esDevuelto,
      };

      detalles.push(detalle);

      // ========================
      // AGRUPADO POR PRODUCTO
      // ========================
      if (!productosMap.has(d.product_id)) {
        productosMap.set(d.product_id, {
          product_id: d.product_id,
          article_code: d.product?.article_code ?? '',
          article_description: d.product?.article_description ?? '',
          brand_name: (d.product as any)?.brand_name ?? '',
          model_code: (d.product as any)?.model_code ?? '',
          color: (d.product as any)?.color ?? '',

          precio_compra_unitario: precioCompra,
          precio_venta_promedio: 0,

          total_pares_registrados: 0,
          total_pares_vendidos: 0,
          total_pares_pendientes: 0,
          total_pares_devueltos: 0,

          total_importe_vendido: 0,
          total_costo_compra: 0,
          total_utilidad: 0,
          margen_utilidad_porcentaje: 0,

          tallas: [],
          _sumaPrecioVenta: 0,
          _cantidadVentas: 0,
        });
      }

      const productoAgg = productosMap.get(d.product_id);

      productoAgg.total_pares_registrados += cantidad;
      productoAgg.total_pares_vendidos += esVendido ? cantidad : 0;
      productoAgg.total_pares_pendientes += esPendiente ? cantidad : 0;
      productoAgg.total_pares_devueltos += esDevuelto ? cantidad : 0;
      productoAgg.total_importe_vendido += importeFinal;
      productoAgg.total_costo_compra += esVendido ? costoCompraTotal : 0;
      productoAgg.total_utilidad += utilidad;

      if (esVendido) {
        productoAgg._sumaPrecioVenta += precioVenta;
        productoAgg._cantidadVentas += 1;
      }

      let tallaAgg = productoAgg.tallas.find((t) => t.talla === d.size);

      if (!tallaAgg) {
        tallaAgg = {
          talla: d.size,
          total_pares_registrados: 0,
          total_pares_vendidos: 0,
          total_pares_pendientes: 0,
          total_pares_devueltos: 0,
          total_importe_vendido: 0,
          total_utilidad: 0,
        };

        productoAgg.tallas.push(tallaAgg);
      }

      tallaAgg.total_pares_registrados += cantidad;
      tallaAgg.total_pares_vendidos += esVendido ? cantidad : 0;
      tallaAgg.total_pares_pendientes += esPendiente ? cantidad : 0;
      tallaAgg.total_pares_devueltos += esDevuelto ? cantidad : 0;
      tallaAgg.total_importe_vendido += importeFinal;
      tallaAgg.total_utilidad += utilidad;

      // ========================
      // AGRUPADO GLOBAL POR TALLA
      // ========================
      const tallaKey = String(d.size ?? 'SIN TALLA');

      if (!tallasMap.has(tallaKey)) {
        tallasMap.set(tallaKey, {
          talla: tallaKey,
          total_pares_registrados: 0,
          total_pares_vendidos: 0,
          total_pares_pendientes: 0,
          total_pares_devueltos: 0,
          total_importe_vendido: 0,
          total_utilidad: 0,
        });
      }

      const tallaGlobal = tallasMap.get(tallaKey);

      tallaGlobal.total_pares_registrados += cantidad;
      tallaGlobal.total_pares_vendidos += esVendido ? cantidad : 0;
      tallaGlobal.total_pares_pendientes += esPendiente ? cantidad : 0;
      tallaGlobal.total_pares_devueltos += esDevuelto ? cantidad : 0;
      tallaGlobal.total_importe_vendido += importeFinal;
      tallaGlobal.total_utilidad += utilidad;
    }

    const resumenVenta = {
      total_importe_registrado: totalImporteRegistrado,
      total_importe_vendido: totalImporteVendido,
      total_importe_pendiente: totalImportePendiente,
      total_importe_devuelto: totalImporteDevuelto,

      total_costo_compra: totalCostoCompra,
      total_utilidad: totalUtilidad,
      margen_utilidad_porcentaje:
        totalImporteVendido > 0
          ? Number(((totalUtilidad / totalImporteVendido) * 100).toFixed(2))
          : 0,

      total_pares_registrados: totalParesRegistrados,
      total_pares_vendidos: totalParesVendidos,
      total_pares_pendientes: totalParesPendientes,
      total_pares_devueltos: totalParesDevueltos,
    };

    const ventaMapeada = {
      sale_id: order.id,
      ticket: `GUIA-${String(order.id).padStart(6, '0')}`,
      fecha_registro: order.request_date,
      estado_pedido: estadoPedido,

      cliente: {
        nombre: order.customer_name ?? order.client?.business_name ?? '',
        dni: order.client?.document_number ?? '',
        telefono: order.customer_phone ?? '',
        direccion: order.customer_address ?? order.client?.address ?? '',
        departamento: '',
        provincia: '',
        distrito: '',
        referencia: order.customer_reference ?? '',
      },

      vendedor: {
        id: order.user?.id,
        nombre: order.user?.full_name ?? '',
        email: order.user?.email ?? '',
        rol: (order.user as any)?.role?.name ?? '',
      },

      pago: {
        metodo_pago: order.payment_method ?? '',
        total_pedido_actual: totalImporteVendido,
        estado_pago: order.payment_status,
        referencia_pago: order.payment_reference,
      },

      envio: {
        es_agencia: false,
        agencia: null,
        codigo_envio: null,
      },

      resumen_venta: resumenVenta,
      detalles,
    };

    detalleVentas.push(ventaMapeada);

    // ========================
    // RESUMEN GENERAL
    // ========================
    resumenGeneral.total_pedidos += 1;

    if (estadoPedido === 'PENDIENTE') resumenGeneral.pedidos_pendientes += 1;
    if (estadoPedido === 'APROBADO') resumenGeneral.pedidos_aprobados += 1;
    if (estadoPedido === 'DESPACHADO') resumenGeneral.pedidos_despachados += 1;
    if (estadoPedido === 'ENTREGADO') resumenGeneral.pedidos_entregados += 1;
    if (estadoPedido === 'CANCELADO') resumenGeneral.pedidos_cancelados += 1;

    resumenGeneral.total_importe_registrado += totalImporteRegistrado;
    resumenGeneral.total_importe_vendido += totalImporteVendido;
    resumenGeneral.total_importe_pendiente += totalImportePendiente;
    resumenGeneral.total_importe_devuelto += totalImporteDevuelto;

    resumenGeneral.total_costo_compra += totalCostoCompra;
    resumenGeneral.total_utilidad += totalUtilidad;

    resumenGeneral.total_pares_registrados += totalParesRegistrados;
    resumenGeneral.total_pares_vendidos += totalParesVendidos;
    resumenGeneral.total_pares_pendientes += totalParesPendientes;
    resumenGeneral.total_pares_devueltos += totalParesDevueltos;

    // ========================
    // RESUMEN POR VENDEDOR
    // ========================
    const vendedorId = order.user?.id ?? 0;

    if (!vendedoresMap.has(vendedorId)) {
      vendedoresMap.set(vendedorId, {
        vendedor_id: vendedorId,
        vendedor: order.user?.full_name ?? '',
        email: order.user?.email ?? '',
        rol: (order.user as any)?.role?.name ?? '',

        total_pedidos: 0,
        pedidos_pendientes: 0,
        pedidos_aprobados: 0,
        pedidos_despachados: 0,
        pedidos_entregados: 0,
        pedidos_cancelados: 0,

        total_importe_registrado: 0,
        total_importe_vendido: 0,
        total_importe_pendiente: 0,
        total_importe_devuelto: 0,

        total_costo_compra: 0,
        total_utilidad: 0,

        total_pares_registrados: 0,
        total_pares_vendidos: 0,
        total_pares_pendientes: 0,
        total_pares_devueltos: 0,

        margen_utilidad_porcentaje: 0,
        ventas: [],
      });
    }

    const vendedorAgg = vendedoresMap.get(vendedorId);

    vendedorAgg.total_pedidos += 1;
    if (estadoPedido === 'PENDIENTE') vendedorAgg.pedidos_pendientes += 1;
    if (estadoPedido === 'APROBADO') vendedorAgg.pedidos_aprobados += 1;
    if (estadoPedido === 'DESPACHADO') vendedorAgg.pedidos_despachados += 1;
    if (estadoPedido === 'ENTREGADO') vendedorAgg.pedidos_entregados += 1;
    if (estadoPedido === 'CANCELADO') vendedorAgg.pedidos_cancelados += 1;

    vendedorAgg.total_importe_registrado += totalImporteRegistrado;
    vendedorAgg.total_importe_vendido += totalImporteVendido;
    vendedorAgg.total_importe_pendiente += totalImportePendiente;
    vendedorAgg.total_importe_devuelto += totalImporteDevuelto;

    vendedorAgg.total_costo_compra += totalCostoCompra;
    vendedorAgg.total_utilidad += totalUtilidad;

    vendedorAgg.total_pares_registrados += totalParesRegistrados;
    vendedorAgg.total_pares_vendidos += totalParesVendidos;
    vendedorAgg.total_pares_pendientes += totalParesPendientes;
    vendedorAgg.total_pares_devueltos += totalParesDevueltos;

    vendedorAgg.ventas.push(ventaMapeada);
  }

  resumenGeneral.margen_utilidad_porcentaje =
    resumenGeneral.total_importe_vendido > 0
      ? Number(
          (
            (resumenGeneral.total_utilidad /
              resumenGeneral.total_importe_vendido) *
            100
          ).toFixed(2),
        )
      : 0;

  const resumenPorVendedor = Array.from(vendedoresMap.values()).map((v) => ({
    ...v,
    margen_utilidad_porcentaje:
      v.total_importe_vendido > 0
        ? Number(((v.total_utilidad / v.total_importe_vendido) * 100).toFixed(2))
        : 0,
  }));

  const resumenPorProducto = Array.from(productosMap.values()).map((p) => {
    p.precio_venta_promedio =
      p._cantidadVentas > 0
        ? Number((p._sumaPrecioVenta / p._cantidadVentas).toFixed(2))
        : 0;

    p.margen_utilidad_porcentaje =
      p.total_importe_vendido > 0
        ? Number(((p.total_utilidad / p.total_importe_vendido) * 100).toFixed(2))
        : 0;

    delete p._sumaPrecioVenta;
    delete p._cantidadVentas;

    return p;
  });

  return {
    filtros: {
      fecha_inicio: dto.fecha_inicio ?? null,
      fecha_fin: dto.fecha_fin ?? null,
      vendedor_id: dto.vendedor_id ?? null,
    },

    resumen_general: resumenGeneral,
    resumen_por_vendedor: resumenPorVendedor,
    resumen_por_producto: resumenPorProducto,
    resumen_por_talla: Array.from(tallasMap.values()),
    detalle_ventas: detalleVentas,
  };
}

}


