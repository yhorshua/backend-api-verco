import {
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { WebSale } from '../database/entities/webSale.entity';
import { WebSaleDetail } from '../database/entities/webDetail.entity';
import { WebSaleStatus } from '../database/entities/webSale.entity';
import { CreateWebSaleDto } from './dto/createWebSaletDto';
import { FilterWebSaleDto } from './dto/filter-websale.dto';

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
    status: WebSaleStatus,
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

    const roleName = user.role?.name_role;

    const allowedRoles = [
      'Administrador',
      'Jefe Ventas',
      'Almacenero'
    ];

    if (!allowedRoles.includes(roleName)) {
      throw new ForbiddenException(
        'No tienes permisos para actualizar estados'
      );
    }

    // =========================================
    // ACTUALIZAR ESTADO
    // =========================================

    sale.status = status;

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
    // VALIDACION POR ROL
    // =========================================

    const roleName = user.role?.name_role;

    // vendedor web -> solo sus ventas
    if (
      roleName === 'Vendedor Web'
    ) {
      query.andWhere('sale.user_id = :userId', {
        userId: user.id
      });
    }

    // jefe ventas y almacenero -> ven todas
    if (
      roleName === 'Jefe Ventas' ||
      roleName === 'Almacen' ||
      roleName === 'Administrador'
    ) {
      // no aplicar filtro
    }

    // =========================================
    // FILTRO ESTADO
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

    query.orderBy(
      'sale.created_at',
      'DESC'
    );

    const sales = await query.getMany();

    return sales.map(sale => ({

      id: sale.id,

      ticket: `Ticket:-${String(sale.id).padStart(6, '0')}`,

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

      seller: {
        id: sale.user.id,
        full_name: sale.user.full_name,
        email: sale.user.email,
        role: sale.user.role?.name_role
      },

      total_products: sale.details.length,

      details: sale.details.map(detail => ({

        id: detail.id,

        product_id: detail.product_id,

        product_name: detail.product?.article_description,

        article_code: detail.product?.article_code,

        image: detail.product?.product_image,

        size: detail.size,

        quantity: detail.quantity,

        sale_price: detail.sale_price,

        subtotal: detail.subtotal
      }))
    }));
  }

}