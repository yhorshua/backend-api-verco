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

@Injectable()
export class WebSaleService {

  constructor(
    @InjectRepository(WebSale)
    private readonly saleRepository: Repository<WebSale>,

    @InjectRepository(WebSaleDetail)
    private readonly detailRepository: Repository<WebSaleDetail>,
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

    const details = createDto.details.map(detail =>
      this.detailRepository.create({
        sale: savedSale,
        product_id: detail.product_id,
        product_size_id: detail.product_size_id,
        size: detail.size,
        quantity: detail.quantity,
        sale_price: detail.sale_price,
        subtotal: detail.subtotal
      })
    );

    await this.detailRepository.save(details);

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
      .leftJoinAndSelect('sale.details', 'details')
      .leftJoinAndSelect('details.product', 'product')
      .leftJoinAndSelect('details.productSize', 'productSize')
      .leftJoinAndSelect('sale.user', 'user')
      .leftJoinAndSelect('user.role', 'role');

    // =========================================
    // OBTENER DATOS DEL USUARIO LOGUEADO
    // =========================================

    const roleName =
      user?.role?.name_role ||
      user?.role;

    const userId =
      user?.userId ||
      user?.id ||
      user?.sub;


    // =========================================
    // VALIDACION POR ROL
    // =========================================

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
          'sale.status = :statusDelivery',
          {
            statusDelivery: WebSaleStatus.DISPATCHED
          }
        );

        break;

      case 'Jefe Ventas':
      case 'Almacen':
      case 'Administrador':
        // Ve todas las ventas
        break;

      default:
        throw new UnauthorizedException(
          'No tiene permisos para consultar ventas'
        );
    }

    // =========================================
    // FILTRO POR ESTADO
    // =========================================

    if (filters.status) {

      query.andWhere(
        'sale.status = :status',
        {
          status: filters.status
        }
      );
    }

    // =========================================
    // FILTRO FECHA INICIO
    // =========================================

    if (filters.startDate) {

      query.andWhere(
        'DATE(sale.created_at) >= :startDate',
        {
          startDate: filters.startDate
        }
      );
    }

    // =========================================
    // FILTRO FECHA FIN
    // =========================================

    if (filters.endDate) {

      query.andWhere(
        'DATE(sale.created_at) <= :endDate',
        {
          endDate: filters.endDate
        }
      );
    }

    if (roleName === 'Delivery') {

      query.andWhere(
        'sale.status = :statusDelivery',
        {
          statusDelivery: WebSaleStatus.DISPATCHED
        }
      );

    } else if (filters.status) {

      query.andWhere(
        'sale.status = :status',
        {
          status: filters.status
        }
      );
    }
    // =========================================
    // ORDENAMIENTO
    // =========================================

    query.orderBy(
      'sale.created_at',
      'DESC'
    );

    // =========================================
    // DEBUG SQL
    // =========================================

    console.log(
      'SQL:',
      query.getSql()
    );

    console.log(
      'PARAMS:',
      query.getParameters()
    );

    const sales = await query.getMany();

    return sales.map(sale => ({

      id: sale.id,

      ticket: `Ticket-${String(sale.id).padStart(6, '0')}`,

      customer_name: sale.customer_name,

      customer_phone: sale.customer_phone,

      customer_address: sale.customer_address,

      department: sale.department,

      province: sale.province,

      district: sale.district,

      payment_method: sale.payment_method,

      observations: sale.observations,

      total_amount: sale.total_amount,

      status: sale.status,

      created_at: sale.created_at,

      shipping_code: sale.shipping_code,

      is_agency_delivery: sale.is_agency_delivery,

      agency_name: sale.agency_name,

      seller: {
        id: sale.user?.id,
        full_name: sale.user?.full_name,
        email: sale.user?.email,
        role: sale.user?.role?.name_role
      },

      total_products: sale.details?.length || 0,

      details: sale.details.map(detail => ({

        id: detail.id,

        product_id: detail.product_id,

        product_name:
          detail.product?.article_description,

        article_code:
          detail.product?.article_code,

        image:
          detail.product?.product_image,

        size: detail.size,

        quantity: detail.quantity,

        sale_price: detail.sale_price,

        subtotal: detail.subtotal

      }))
    }));
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
}