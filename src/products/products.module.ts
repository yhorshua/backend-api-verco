import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { Product } from './entities/product.entity';
import { Stock } from './entities/stock.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Product, Stock])], // 👈 registra repositorios
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService], // opcional si otros módulos usan ProductsService
})
export class ProductsModule {}