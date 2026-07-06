import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { EfactService } from './efact.service';
import { WebSale } from '../database/entities/webSale.entity';
import { WebSaleInvoice } from '../database/entities/webSaleInvoices';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      WebSale,
      WebSaleInvoice,
    ]),
  ],
  providers: [
    EfactService,
  ],
  exports: [
    EfactService,
  ],
})
export class EfactModule {}