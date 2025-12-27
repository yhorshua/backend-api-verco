import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProductsModule } from './products/products.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';

import { User } from './database/entities/user.entity';
import { Product } from './database/entities/product.entity';
import { Warehouse } from './database/entities/warehouse.entity';
import { Order } from './database/entities/orders.entity';
import { OrderDetail } from './database/entities/order-details.entity';
import { ProductSize } from './database/entities/product-size.entity';
import { Client } from './database/entities/client.entity';
import { DocumentType } from './database/entities/document-types.entity';
import { InventoryMovement } from './database/entities/inventory-movements.entity';
import { OrderStatus } from './database/entities/order-status.entity';
import { Role } from './database/entities/role.entity';
import { Sale } from './database/entities/sale.entity';
import { SaleDetail } from './database/entities/sale-detail.entity';
import { Series } from './database/entities/series.entity';
import { StockMovement } from './database/entities/stock-movements';
import { Stock } from './database/entities/stock.entity';
import { StockModule } from './products/stock.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRoot({
      type: 'mysql',                                      // 👈 CAMBIADO
      host: process.env.DB_HOST,                         // 👈 Host de Hostinger
      port: Number(process.env.DB_PORT) || 3306,         // 👈 Puerto MySQL
      username: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      synchronize: false,                                // true solo en desarrollo
      retryAttempts: 10,
      retryDelay: 5000,
      connectTimeout: 30000,                             // en mysql se llama connectTimeout
      entities: [
        User,
        Product,
        Warehouse,
        Order,
        OrderDetail,
        ProductSize,
        Client,
        DocumentType,
        InventoryMovement,
        OrderStatus,
        Role,
        Sale,
        SaleDetail,
        Series,
        StockMovement,
        Stock,
      ],
    }),

    ProductsModule,
    DatabaseModule,
    UsersModule,
    AuthModule,
    StockModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
