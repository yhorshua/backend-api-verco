import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { WebSale } from '../database/entities/webSale.entity';
import { DetailStatus, WebSaleDetail } from '../database/entities/webDetail.entity';
import { WebSaleStatus } from '../database/entities/webSale.entity';
import { CreateWebSaleDto } from './dto/createWebSaletDto';
import { FilterWebSaleDto } from './dto/filter-websale.dto';
import { UpdateWebSaleDto } from './dto/updateWebSaleDto';
import { DeliverSaleDto } from './dto/deliverySaleDto';
import { WebSalesReportFiltersDto } from './dto/web-sales-report.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DASHBOARD_EVENTS } from '../dashCounter/dto/dashboard-events.constants';
import { Product } from 'src/database/entities/product.entity';

@Injectable()
export class WebSaleService {

  constructor(
    @InjectRepository(WebSale)
    private readonly saleRepository: Repository<WebSale>,

    @InjectRepository(WebSaleDetail)
    private readonly detailRepository: Repository<WebSaleDetail>,

    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,

    private readonly eventEmitter: EventEmitter2,
  ) { }

  async create(createDto: CreateWebSaleDto) {

    const sale = this.saleRepository.create({
      customer_name: createDto.customer_name,
      customer_dni: createDto.customer_dni,
      customer_phone: createDto.customer_phone,
      customer_address: createDto.customer_address,
      department: createDto.department,
      province: createDto.province,
      district: createDto.district,
      reference: createDto.reference,
      payment_method: createDto.payment_method,
      observations: createDto.observations,
      total_amount: createDto.total_amount,
      is_agency_delivery:
        createDto.is_agency_delivery,

      agency_name:
        createDto.agency_name,
      user: {
        id: createDto.user_id
      }
    });

    const savedSale = await this.saleRepository.save(sale);

    const details: WebSaleDetail[] = [];

    for (const detail of createDto.details) {
      const product = await this.productRepository.findOne({
        where: {
          id: detail.product_id
        }
      });

      if (!product) {
        throw new NotFoundException(
          `No se encontró el producto con ID ${detail.product_id}`
        );
      }

      const newDetail = this.detailRepository.create({
        sale: savedSale,
        product_id: detail.product_id,
        product_size_id: detail.product_size_id,
        size: detail.size,
        quantity: detail.quantity,
        sale_price: detail.sale_price,
        subtotal: detail.subtotal,

        // Precio de compra histórico
        purchase_price_at_sale: product.factory_price
      });

      details.push(newDetail);
    }

    await this.detailRepository.save(details);

    const ticket = `Ticket-${String(savedSale.id).padStart(6, '0')}`;

    this.eventEmitter.emit(DASHBOARD_EVENTS.WEBSALE_CREATED, {
      saleId: savedSale.id,
      customerName: savedSale.customer_name,
      ticket,
    });

    return {
      message: 'Venta registrada correctamente',
      sale_id: savedSale.id
    };
  }

  async findAll() {

    return await this.saleRepository.find({
      relations: [
        'details',
        'details.product',
        'details.productSize',
        'user'
      ],
      order: {
        created_at: 'DESC'
      }
    });
  }

  async findOne(id: number) {

    const sale = await this.saleRepository.findOne({
      where: { id },
      relations: [
        'details',
        'details.product',
        'details.productSize',
        'user'
      ]
    });

    if (!sale) {
      throw new NotFoundException('Venta no encontrada');
    }

    return sale;
  }


  async updateStatus(
    id: number,
    dto: UpdateWebSaleDto,
    user: any
  ) {

    const sale = await this.saleRepository.findOne({
      where: { id },
      relations: ['user', 'user.role']
    });

    if (!sale) {
      throw new NotFoundException(
        'Venta no encontrada'
      );
    }

    // =========================================
    // VALIDACION DE ROLES
    // =========================================
    const roleName =
      user?.role?.name_role ||
      user?.role;

    const allowedRoles = [
      'Administrador',
      'Jefe Ventas',
      'Almacenero',
      'Delivery'
    ];

    if (!allowedRoles.includes(roleName)) {
      throw new ForbiddenException(
        'No tienes permisos para actualizar estados'
      );
    }

    // =========================================
    // ACTUALIZAR ESTADO
    // =========================================
    if (
      sale.is_agency_delivery &&
      dto.status === WebSaleStatus.DELIVERED &&
      !dto.shipping_code
    ) {
      throw new BadRequestException(
        'Debe ingresar el código de envío'
      );
    }

    if (dto.status === WebSaleStatus.CANCELED) {

      const details = await this.detailRepository.find({
        where: { sale: { id } }
      });

      for (const d of details) {
        d.detail_status = DetailStatus.DEVUELTO;
        d.final_amount = 0;
        d.returned_at = new Date();
        await this.detailRepository.save(d);
      }

      sale.total_amount = 0;
    }

    sale.status = dto.status;

    if (
      sale.is_agency_delivery &&
      dto.shipping_code
    ) {
      sale.shipping_code = dto.shipping_code;
    }

    await this.saleRepository.save(sale);

    return {

      message: 'Estado actualizado correctamente',

      sale_id: sale.id,

      ticket: `Ticket:-${String(sale.id).padStart(6, '0')}`,

      status: sale.status
    };
  }


  async findFilteredSales(
    user: any,
    filters: FilterWebSaleDto
  ) {

    const query = this.saleRepository
      .createQueryBuilder('sale')

      .leftJoinAndSelect(
        'sale.details',
        'details'
      )

      .leftJoinAndSelect(
        'details.product',
        'product'
      )

      .leftJoinAndSelect(
        'details.productSize',
        'productSize'
      )

      .leftJoinAndSelect(
        'sale.user',
        'user'
      )

      .leftJoinAndSelect(
        'user.role',
        'role'
      );


    const roleName =
      user?.role?.name_role ||
      user?.role;


    const userId =
      user?.userId ||
      user?.id ||
      user?.sub;



    // ==============================
    // PERMISOS
    // ==============================

    switch (roleName) {

      case 'Vendedor Web':

        query.andWhere(
          'user.id = :userId',
          {
            userId
          }
        );

        break;


      case 'Delivery':

        query.andWhere(
          'sale.status = :deliveryStatus',
          {
            deliveryStatus:
              WebSaleStatus.DISPATCHED
          }
        );

        break;



      case 'Jefe Ventas':
      case 'Almacen':
      case 'Administrador':

        break;


      default:

        throw new UnauthorizedException(
          'No tiene permisos para consultar ventas'
        );

    }



    // ==============================
    // FILTROS
    // ==============================


    if (filters.status) {

      query.andWhere(
        'sale.status = :status',
        {
          status: filters.status
        }
      );

    }



    if (filters.startDate) {

      query.andWhere(
        'DATE(sale.created_at) >= :startDate',
        {
          startDate: filters.startDate
        }
      );

    }



    if (filters.endDate) {

      query.andWhere(
        'DATE(sale.created_at) <= :endDate',
        {
          endDate: filters.endDate
        }
      );

    }



    query.orderBy(
      'sale.created_at',
      'DESC'
    );



    console.log(
      query.getSql()
    );



    const sales = await query.getMany();



    return sales.map(
      sale => ({


        // ======================
        // CABECERA VENTA
        // ======================

        id: sale.id,


        ticket:
          `Ticket-${String(sale.id).padStart(6, '0')}`,


        customer_name:
          sale.customer_name,


        customer_phone:
          sale.customer_phone,


        customer_address:
          sale.customer_address,


        customer_dni:
          sale.customer_dni,


        department:
          sale.department,


        province:
          sale.province,


        district:
          sale.district,


        payment_method:
          sale.payment_method,


        observations:
          sale.observations,


        total_amount:
          sale.total_amount,


        status:
          sale.status,


        created_at:
          sale.created_at,


        shipping_code:
          sale.shipping_code,


        is_agency_delivery:
          sale.is_agency_delivery,


        agency_name:
          sale.agency_name,



        // ======================
        // USUARIO
        // ======================

        seller: {

          id:
            sale.user?.id,


          full_name:
            sale.user?.full_name,


          email:
            sale.user?.email,


          role:
            sale.user?.role?.name_role

        },



        // ======================
        // PRODUCTOS
        // ======================


        total_products:
          sale.details?.reduce(
            (sum, item) =>
              sum + Number(item.quantity),
            0
          ) || 0,



        details:

          sale.details?.map(detail => ({

            id:
              detail.id,


            product_id:
              detail.product_id,


            product_name:
              detail.product
                ?.article_description,


            article_code:
              detail.product
                ?.article_code,


            image:
              detail.product
                ?.product_image,


            size:
              detail.size ||
              detail.productSize?.size,


            quantity:
              detail.quantity,


            sale_price:
              detail.sale_price,


            subtotal:
              detail.subtotal


          })) || []

      })

    );

  }

  async deliverSale(
    saleId: number,
    dto: DeliverSaleDto
  ) {

    const sale =
      await this.saleRepository.findOne({
        where: {
          id: saleId
        },
        relations: ['details']
      });

    if (!sale) {
      throw new NotFoundException();
    }

    let finalAmount = 0;

    for (const detail of sale.details) {

      const sentDetail =
        dto.details?.find(
          d => d.detail_id === detail.id
        );

      const status =
        sentDetail?.status ||
        DetailStatus.VENDIDO;

      detail.detail_status = status;

      if (
        status === DetailStatus.VENDIDO
      ) {

        detail.sold_at = new Date();

        detail.final_amount =
          Number(detail.subtotal);

        finalAmount +=
          Number(detail.subtotal);
      }

      if (
        status === DetailStatus.DEVUELTO
      ) {

        detail.returned_at =
          new Date();

        detail.final_amount = 0;
      }

      await this.detailRepository.save(
        detail
      );
    }

    sale.total_amount =
      finalAmount;

    sale.status =
      WebSaleStatus.DELIVERED;

    await this.saleRepository.save(
      sale
    );

    return {
      message:
        'Entrega registrada correctamente'
    };
  }

  async getWebSalesReport(filters: WebSalesReportFiltersDto) {
    const { startDate, endDate, userId } = filters;

    const query = this.saleRepository
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.details', 'detail')
      .leftJoinAndSelect('detail.product', 'product')
      .leftJoinAndSelect('detail.productSize', 'productSize')
      .leftJoinAndSelect('sale.user', 'seller')
      .leftJoinAndSelect('seller.role', 'role');

    if (startDate) {
      query.andWhere('CAST(sale.created_at AS DATE) >= :startDate', {
        startDate,
      });
    }

    if (endDate) {
      query.andWhere('CAST(sale.created_at AS DATE) <= :endDate', {
        endDate,
      });
    }

    if (userId) {
      query.andWhere('sale.user_id = :userId', {
        userId,
      });
    }

    query.orderBy('sale.created_at', 'DESC');

    const sales = await query.getMany();

    let totalPedidos = 0;
    let pedidosPendientes = 0;
    let pedidosAprobados = 0;
    let pedidosDespachados = 0;
    let pedidosEntregados = 0;
    let pedidosCancelados = 0;

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

    const reportePorVendedor: Record<string, any> = {};
    const reportePorProducto: Record<string, any> = {};
    const reportePorTalla: Record<string, any> = {};
    const detalleVentas: any[] = [];

    for (const sale of sales) {
      totalPedidos++;

      if (sale.status === WebSaleStatus.PENDING) pedidosPendientes++;
      if (sale.status === WebSaleStatus.APPROVED) pedidosAprobados++;
      if (sale.status === WebSaleStatus.DISPATCHED) pedidosDespachados++;
      if (sale.status === WebSaleStatus.DELIVERED) pedidosEntregados++;
      if (sale.status === WebSaleStatus.CANCELED) pedidosCancelados++;

      const sellerId = sale.user?.id || 0;
      const sellerName = sale.user?.full_name || 'Sin vendedor';

      if (!reportePorVendedor[sellerId]) {
        reportePorVendedor[sellerId] = {
          vendedor_id: sellerId,
          vendedor: sellerName,
          email: sale.user?.email || '',
          rol: sale.user?.role?.name_role || '',

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

          ventas: [],
        };
      }

      const vendedorResumen = reportePorVendedor[sellerId];

      vendedorResumen.total_pedidos++;

      if (sale.status === WebSaleStatus.PENDING) vendedorResumen.pedidos_pendientes++;
      if (sale.status === WebSaleStatus.APPROVED) vendedorResumen.pedidos_aprobados++;
      if (sale.status === WebSaleStatus.DISPATCHED) vendedorResumen.pedidos_despachados++;
      if (sale.status === WebSaleStatus.DELIVERED) vendedorResumen.pedidos_entregados++;
      if (sale.status === WebSaleStatus.CANCELED) vendedorResumen.pedidos_cancelados++;

      let ventaImporteRegistrado = 0;
      let ventaImporteVendido = 0;
      let ventaImportePendiente = 0;
      let ventaImporteDevuelto = 0;
      let ventaCostoCompra = 0;
      let ventaUtilidad = 0;

      let ventaParesRegistrados = 0;
      let ventaParesVendidos = 0;
      let ventaParesPendientes = 0;
      let ventaParesDevueltos = 0;

      const detalles = sale.details?.map((detail) => {
        const quantity = Number(detail.quantity || 0);

        const precioVentaUnitario = Number(detail.sale_price || 0);
        const subtotalRegistrado = Number(detail.subtotal || 0);

        const precioCompraUnitario = Number(
          detail.product?.factory_price || 0,
        );

        const costoCompraTotal = precioCompraUnitario * quantity;

        const importeFinal =
          detail.final_amount !== null && detail.final_amount !== undefined
            ? Number(detail.final_amount)
            : subtotalRegistrado;

        let importeVendido = 0;
        let importePendiente = 0;
        let importeDevuelto = 0;

        let paresVendidos = 0;
        let paresPendientes = 0;
        let paresDevueltos = 0;

        if (detail.detail_status === DetailStatus.VENDIDO) {
          importeVendido = importeFinal;
          paresVendidos = quantity;
        }

        if (detail.detail_status === DetailStatus.PENDIENTE) {
          importePendiente = subtotalRegistrado;
          paresPendientes = quantity;
        }

        if (detail.detail_status === DetailStatus.DEVUELTO) {
          importeDevuelto = subtotalRegistrado;
          paresDevueltos = quantity;
        }

        const utilidadDetalle =
          detail.detail_status === DetailStatus.VENDIDO
            ? importeVendido - costoCompraTotal
            : 0;

        const margenUtilidadPorcentaje =
          importeVendido > 0
            ? Number(((utilidadDetalle / importeVendido) * 100).toFixed(2))
            : 0;

        ventaImporteRegistrado += subtotalRegistrado;
        ventaImporteVendido += importeVendido;
        ventaImportePendiente += importePendiente;
        ventaImporteDevuelto += importeDevuelto;
        ventaCostoCompra +=
          detail.detail_status === DetailStatus.VENDIDO
            ? costoCompraTotal
            : 0;
        ventaUtilidad += utilidadDetalle;

        ventaParesRegistrados += quantity;
        ventaParesVendidos += paresVendidos;
        ventaParesPendientes += paresPendientes;
        ventaParesDevueltos += paresDevueltos;

        const productId = detail.product?.id || detail.product_id;
        const articleCode = detail.product?.article_code || 'SIN-CODIGO';
        const productName = detail.product?.article_description || 'Sin producto';
        const size = detail.size || detail.productSize?.size || 'SIN-TALLA';

        const productKey = `${productId}-${articleCode}`;

        if (!reportePorProducto[productKey]) {
          reportePorProducto[productKey] = {
            product_id: productId,
            article_code: articleCode,
            article_description: productName,
            brand_name: detail.product?.brand_name || '',
            model_code: detail.product?.model_code || '',
            color: detail.product?.color || '',

            precio_compra_unitario: precioCompraUnitario,
            precio_venta_promedio: 0,

            total_pares_registrados: 0,
            total_pares_vendidos: 0,
            total_pares_pendientes: 0,
            total_pares_devueltos: 0,

            total_importe_vendido: 0,
            total_costo_compra: 0,
            total_utilidad: 0,

            tallas: {},
          };
        }

        const productoResumen = reportePorProducto[productKey];

        productoResumen.total_pares_registrados += quantity;
        productoResumen.total_pares_vendidos += paresVendidos;
        productoResumen.total_pares_pendientes += paresPendientes;
        productoResumen.total_pares_devueltos += paresDevueltos;

        productoResumen.total_importe_vendido += importeVendido;
        productoResumen.total_costo_compra +=
          detail.detail_status === DetailStatus.VENDIDO
            ? costoCompraTotal
            : 0;
        productoResumen.total_utilidad += utilidadDetalle;

        if (!productoResumen.tallas[size]) {
          productoResumen.tallas[size] = {
            talla: size,
            total_pares_registrados: 0,
            total_pares_vendidos: 0,
            total_pares_pendientes: 0,
            total_pares_devueltos: 0,
            total_importe_vendido: 0,
            total_utilidad: 0,
          };
        }

        productoResumen.tallas[size].total_pares_registrados += quantity;
        productoResumen.tallas[size].total_pares_vendidos += paresVendidos;
        productoResumen.tallas[size].total_pares_pendientes += paresPendientes;
        productoResumen.tallas[size].total_pares_devueltos += paresDevueltos;
        productoResumen.tallas[size].total_importe_vendido += importeVendido;
        productoResumen.tallas[size].total_utilidad += utilidadDetalle;

        if (!reportePorTalla[size]) {
          reportePorTalla[size] = {
            talla: size,
            total_pares_registrados: 0,
            total_pares_vendidos: 0,
            total_pares_pendientes: 0,
            total_pares_devueltos: 0,
            total_importe_vendido: 0,
            total_utilidad: 0,
          };
        }

        reportePorTalla[size].total_pares_registrados += quantity;
        reportePorTalla[size].total_pares_vendidos += paresVendidos;
        reportePorTalla[size].total_pares_pendientes += paresPendientes;
        reportePorTalla[size].total_pares_devueltos += paresDevueltos;
        reportePorTalla[size].total_importe_vendido += importeVendido;
        reportePorTalla[size].total_utilidad += utilidadDetalle;

        return {
          detalle_id: detail.id,
          estado_detalle: detail.detail_status,

          product_id: productId,
          product_size_id: detail.product_size_id,

          article_code: articleCode,
          article_description: productName,
          brand_name: detail.product?.brand_name || '',
          model_code: detail.product?.model_code || '',
          color: detail.product?.color || '',

          talla: size,
          cantidad_pares: quantity,

          precio_compra_unitario: precioCompraUnitario,
          precio_venta_unitario: precioVentaUnitario,

          subtotal_registrado: subtotalRegistrado,
          importe_final: importeFinal,

          costo_compra_total: costoCompraTotal,
          utilidad: utilidadDetalle,
          margen_utilidad_porcentaje: margenUtilidadPorcentaje,

          vendido: detail.detail_status === DetailStatus.VENDIDO,
          pendiente: detail.detail_status === DetailStatus.PENDIENTE,
          devuelto: detail.detail_status === DetailStatus.DEVUELTO,

          sold_at: detail.sold_at,
          returned_at: detail.returned_at,
        };
      }) || [];

      totalImporteRegistrado += ventaImporteRegistrado;
      totalImporteVendido += ventaImporteVendido;
      totalImportePendiente += ventaImportePendiente;
      totalImporteDevuelto += ventaImporteDevuelto;
      totalCostoCompra += ventaCostoCompra;
      totalUtilidad += ventaUtilidad;

      totalParesRegistrados += ventaParesRegistrados;
      totalParesVendidos += ventaParesVendidos;
      totalParesPendientes += ventaParesPendientes;
      totalParesDevueltos += ventaParesDevueltos;

      vendedorResumen.total_importe_registrado += ventaImporteRegistrado;
      vendedorResumen.total_importe_vendido += ventaImporteVendido;
      vendedorResumen.total_importe_pendiente += ventaImportePendiente;
      vendedorResumen.total_importe_devuelto += ventaImporteDevuelto;
      vendedorResumen.total_costo_compra += ventaCostoCompra;
      vendedorResumen.total_utilidad += ventaUtilidad;

      vendedorResumen.total_pares_registrados += ventaParesRegistrados;
      vendedorResumen.total_pares_vendidos += ventaParesVendidos;
      vendedorResumen.total_pares_pendientes += ventaParesPendientes;
      vendedorResumen.total_pares_devueltos += ventaParesDevueltos;

      const utilidadVentaPorcentaje =
        ventaImporteVendido > 0
          ? Number(((ventaUtilidad / ventaImporteVendido) * 100).toFixed(2))
          : 0;

      const ventaReporte = {
        sale_id: sale.id,
        ticket: `Ticket-${String(sale.id).padStart(6, '0')}`,

        fecha_registro: sale.created_at,
        estado_pedido: sale.status,

        cliente: {
          nombre: sale.customer_name,
          dni: sale.customer_dni,
          telefono: sale.customer_phone,
          direccion: sale.customer_address,
          departamento: sale.department,
          provincia: sale.province,
          distrito: sale.district,
          referencia: sale.reference,
        },

        vendedor: {
          id: sellerId,
          nombre: sellerName,
          email: sale.user?.email || '',
          rol: sale.user?.role?.name_role || '',
        },

        pago: {
          metodo_pago: sale.payment_method,
          total_pedido_actual: Number(sale.total_amount || 0),
        },

        envio: {
          es_agencia: sale.is_agency_delivery,
          agencia: sale.agency_name,
          codigo_envio: sale.shipping_code,
        },

        resumen_venta: {
          total_importe_registrado: Number(ventaImporteRegistrado.toFixed(2)),
          total_importe_vendido: Number(ventaImporteVendido.toFixed(2)),
          total_importe_pendiente: Number(ventaImportePendiente.toFixed(2)),
          total_importe_devuelto: Number(ventaImporteDevuelto.toFixed(2)),

          total_costo_compra: Number(ventaCostoCompra.toFixed(2)),
          total_utilidad: Number(ventaUtilidad.toFixed(2)),
          margen_utilidad_porcentaje: utilidadVentaPorcentaje,

          total_pares_registrados: ventaParesRegistrados,
          total_pares_vendidos: ventaParesVendidos,
          total_pares_pendientes: ventaParesPendientes,
          total_pares_devueltos: ventaParesDevueltos,
        },

        detalles,
      };

      vendedorResumen.ventas.push(ventaReporte);
      detalleVentas.push(ventaReporte);
    }

    const margenUtilidadGeneral =
      totalImporteVendido > 0
        ? Number(((totalUtilidad / totalImporteVendido) * 100).toFixed(2))
        : 0;

    const vendedores = Object.values(reportePorVendedor).map((vendedor: any) => {
      const margen =
        vendedor.total_importe_vendido > 0
          ? Number(
            (
              (vendedor.total_utilidad / vendedor.total_importe_vendido) *
              100
            ).toFixed(2),
          )
          : 0;

      return {
        ...vendedor,
        total_importe_registrado: Number(
          vendedor.total_importe_registrado.toFixed(2),
        ),
        total_importe_vendido: Number(
          vendedor.total_importe_vendido.toFixed(2),
        ),
        total_importe_pendiente: Number(
          vendedor.total_importe_pendiente.toFixed(2),
        ),
        total_importe_devuelto: Number(
          vendedor.total_importe_devuelto.toFixed(2),
        ),
        total_costo_compra: Number(vendedor.total_costo_compra.toFixed(2)),
        total_utilidad: Number(vendedor.total_utilidad.toFixed(2)),
        margen_utilidad_porcentaje: margen,
      };
    });

    const productos = Object.values(reportePorProducto).map((producto: any) => {
      const precioVentaPromedio =
        producto.total_pares_vendidos > 0
          ? producto.total_importe_vendido / producto.total_pares_vendidos
          : 0;

      const margen =
        producto.total_importe_vendido > 0
          ? Number(
            (
              (producto.total_utilidad / producto.total_importe_vendido) *
              100
            ).toFixed(2),
          )
          : 0;

      return {
        ...producto,
        precio_venta_promedio: Number(precioVentaPromedio.toFixed(2)),
        total_importe_vendido: Number(producto.total_importe_vendido.toFixed(2)),
        total_costo_compra: Number(producto.total_costo_compra.toFixed(2)),
        total_utilidad: Number(producto.total_utilidad.toFixed(2)),
        margen_utilidad_porcentaje: margen,
        tallas: Object.values(producto.tallas),
      };
    });

    const tallas = Object.values(reportePorTalla);

    return {
      filtros: {
        fecha_inicio: startDate || null,
        fecha_fin: endDate || null,
        vendedor_id: userId || null,
      },

      resumen_general: {
        total_pedidos: totalPedidos,

        pedidos_pendientes: pedidosPendientes,
        pedidos_aprobados: pedidosAprobados,
        pedidos_despachados: pedidosDespachados,
        pedidos_entregados: pedidosEntregados,
        pedidos_cancelados: pedidosCancelados,

        total_importe_registrado: Number(totalImporteRegistrado.toFixed(2)),
        total_importe_vendido: Number(totalImporteVendido.toFixed(2)),
        total_importe_pendiente: Number(totalImportePendiente.toFixed(2)),
        total_importe_devuelto: Number(totalImporteDevuelto.toFixed(2)),

        total_costo_compra: Number(totalCostoCompra.toFixed(2)),
        total_utilidad: Number(totalUtilidad.toFixed(2)),
        margen_utilidad_porcentaje: margenUtilidadGeneral,

        total_pares_registrados: totalParesRegistrados,
        total_pares_vendidos: totalParesVendidos,
        total_pares_pendientes: totalParesPendientes,
        total_pares_devueltos: totalParesDevueltos,
      },

      resumen_por_vendedor: vendedores,

      resumen_por_producto: productos,

      resumen_por_talla: tallas,

      detalle_ventas: detalleVentas,
    };
  }
}