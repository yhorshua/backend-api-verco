import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PackingController } from './packing.controller';
import { PackingService } from './packing.service';

import { Escaneo } from '../database/entities/escaneo.entity';
import { OrderDetail } from '../database/entities/order-details.entity';
import { Product } from '../database/entities/product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Escaneo, OrderDetail, Product])],
  controllers: [PackingController],
  providers: [PackingService],
})
export class PackingModule {}
