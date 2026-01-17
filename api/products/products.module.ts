import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { Product } from '../database/entities/product.entity';
import { Stock } from '../database/entities/stock.entity';
import { ProductSize } from 'api/database/entities/product-size.entity';
import { Series } from 'api/database/entities/series.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Product, Stock, ProductSize, Series])], // 👈 registra repositorios
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService], // opcional si otros módulos usan ProductsService
})
export class ProductsModule {}