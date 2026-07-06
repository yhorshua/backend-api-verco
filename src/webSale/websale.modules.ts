import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WebSale } from '../database/entities/webSale.entity';
import { WebSaleDetail } from '../database/entities/webDetail.entity';

import { WebSaleController } from './websale.controller';

import { WebSaleService } from './websale.service';
import { Product } from 'src/database/entities/product.entity';
import { WebSaleInvoice } from 'src/database/entities/webSaleInvoices';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WebSale,
      WebSaleDetail,
      Product,
      WebSaleInvoice,
    ])
  ],
  controllers: [WebSaleController],
  providers: [
    WebSaleService,
  ],
  exports: [
    WebSaleService
  ]
})
export class WebSaleModule {}