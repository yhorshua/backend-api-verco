import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PackingController } from './packing.controller';
import { PackingService } from './packing.service';

import { Escaneo } from '../database/entities/escaneo.entity';
import { OrderDetail } from '../database/entities/order-details.entity';
import { Product } from '../database/entities/product.entity';
import { Order } from 'src/database/entities/orders.entity';
import { InventoryMovement } from 'src/database/entities/inventory-movements.entity';
import { StockReservation } from 'src/database/entities/stock_reservations.entity';
import { Stock } from 'src/database/entities/stock.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Escaneo, OrderDetail, Product, Order, InventoryMovement, StockReservation, Stock])],
  controllers: [PackingController],
  providers: [PackingService],
})
export class PackingModule { }
