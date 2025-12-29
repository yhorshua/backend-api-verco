import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

import { Sale } from '../database/entities/sale.entity';
import { SaleDetail } from '../database/entities/sale-detail.entity';
import { SalePayment } from '../database/entities/sale-payments.entity';
import { Warehouse } from '../database/entities/warehouse.entity';
import { User } from '../database/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Sale, SaleDetail, SalePayment, Warehouse, User])],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
