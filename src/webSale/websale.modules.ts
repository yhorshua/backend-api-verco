import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WebSale } from '../database/entities/webSale.entity';
import { WebSaleDetail } from '../database/entities/webDetail.entity';

import { WebSaleController } from './websale.controller';

import { WebSaleService } from './websale.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WebSale,
      WebSaleDetail
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