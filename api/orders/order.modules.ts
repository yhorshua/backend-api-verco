import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

import { Order } from '../database/entities/orders.entity';
import { OrderDetail } from '../database/entities/order-details.entity';
import { Stock } from '../database/entities/stock.entity';
import { InventoryMovement } from '../database/entities/inventory-movements.entity';
import { Product } from '../database/entities/product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderDetail, Stock, InventoryMovement, Product])],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
