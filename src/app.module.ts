import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProductsModule } from './products/products.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module'; // 👈 AÑADE ESTO
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




@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRoot({
      type: 'mssql',
      host: process.env.DB_HOST || 'server-system-verco.database.windows.net',
      username: process.env.DB_USER || 'server-verco',
      password: process.env.DB_PASS || 'Ventas@123',
      database: process.env.DB_NAME || 'bd_verco',
      synchronize: false,
      options: {
        encrypt: true,
        trustServerCertificate: false,
      },
      retryAttempts: 10,
      retryDelay: 5000,
      connectionTimeout: 30000,
      entities: [
        User,
        Product,
        Warehouse,
        Order,
        OrderDetail,
        ProductSize,
        Product,
        Client,
        DocumentType,
        InventoryMovement,
        OrderStatus,
        OrderDetail,
        Role,
        Sale,
        SaleDetail,
        Series,
        StockMovement,
        Stock,
        OrderStatus  
      ],
    }),

    ProductsModule,
    DatabaseModule,
    UsersModule, // 👈 AGREGA AQUÍ
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
