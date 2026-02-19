import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SaleService } from './sale.service';
import { SaleController } from './sales.controller';
import { Sale } from '../database/entities/sale.entity';
import { SaleDetail } from '../database/entities/sale-detail.entity';
import { Stock } from '../database/entities/stock.entity';
import { StockMovement } from '../database/entities/stock-movements';
import { Product } from '../database/entities/product.entity';
import { Warehouse } from '../database/entities/warehouse.entity';
import { User } from '../database/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Sale, // Entidad de ventas
      SaleDetail, // Detalles de la venta
      Stock, // Stock
      StockMovement, // Movimientos de stock
      Product, // Productos
      Warehouse, // Almacenes
      User, // Usuarios
    ]),
  ],
  controllers: [SaleController], // Controlador de ventas
  providers: [SaleService], // Servicio de ventas
})
export class SaleModule {}
