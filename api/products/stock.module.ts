import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Stock } from '../database/entities/stock.entity';
import { StockMovement } from '../database/entities/stock-movements';
import { Sale } from '../database/entities/sale.entity';
import { SaleDetail } from '../database/entities/sale-detail.entity';
import { WarehouseSaleSequence } from '../database/entities/warehouse-sale-sequence.entity';

import { StockController } from './stock.controller';
import { StockService } from './stock.service';
import { SalePayment } from '../database/entities/sale-payments.entity';
import { CashRegisterSession } from '../database/entities/cash-register-session.entity';
import { CashMovement } from '../database/entities/cash-movement.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Stock,
      StockMovement,
      Sale,
      SaleDetail,
      WarehouseSaleSequence,
      SalePayment,
      CashRegisterSession,
      CashMovement,
    ]),
  ],
  controllers: [StockController],
  providers: [StockService],
  exports: [StockService],
})
export class StockModule { }
