  import {
    Injectable,
    NotFoundException
  } from '@nestjs/common';

  import { InjectRepository } from '@nestjs/typeorm';
  import { Repository } from 'typeorm';

  import { WebSale } from '../database/entities/webSale.entity';
  import { WebSaleDetail } from '../database/entities/webDetail.entity';
import { WebSaleStatus } from '../database/entities/webSale.entity';
  import { CreateWebSaleDto } from './dto/createWebSaletDto';

  @Injectable()
  export class WebSaleService {

    constructor(
      @InjectRepository(WebSale)
      private readonly saleRepository: Repository<WebSale>,

      @InjectRepository(WebSaleDetail)
      private readonly detailRepository: Repository<WebSaleDetail>,
    ) {}

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
        user_id: createDto.user_id,
      });

      const savedSale = await this.saleRepository.save(sale);

      const details = createDto.details.map(detail =>
        this.detailRepository.create({
          sale_id: savedSale.id,
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

    async updateStatus(id: number, status: WebSaleStatus) {
    
        const sale = await this.saleRepository.findOne({
          where: { id }
        });
    
        if (!sale) {
          throw new NotFoundException('Venta no encontrada');
        }
    
        sale.status = status;
    
        return await this.saleRepository.save(sale);
      }
  }