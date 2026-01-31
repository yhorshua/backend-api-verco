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
import { CashMovement } from './database/entities/cash-movement.entity';
import { CashRegisterSession } from './database/entities/cash-register-session.entity';
import { SalePayment } from './database/entities/sale-payments.entity';
import { WarehouseSaleSequence } from './database/entities/warehouse-sale-sequence.entity';
import { CashModule } from './cash/cash.module';
import { ReportsModule } from './report/reports.module';
import { RolesModule } from './rol/roles.module';
import { WarehousesModule } from './warehouses/warehouses.module';
import { ClientsModule } from './clients/clients.module';
import { DocumentTypesModule } from './documentTypes/document-types.module';
import { OrdersModule } from './orders/order.modules';
import { StockReservation } from './database/entities/stock_reservations.entity';
import { PackingModule } from './packing/packing.module';
import { Escaneo } from './database/entities/escaneo.entity';
import { CategoriesModule } from './categories/categories.module';
import { Category } from './database/entities/categories.entity';

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
        CashMovement,
        CashRegisterSession,
        SalePayment,
        WarehouseSaleSequence,
        StockReservation,
        Escaneo,
        Category,
      ],
    }),

    ProductsModule,
    DatabaseModule,
    UsersModule,
    AuthModule,
    StockModule,
    CashModule,
    ReportsModule,
    RolesModule,
    WarehousesModule,
    ClientsModule,
    DocumentTypesModule,
    OrdersModule,
    PackingModule,
    CategoriesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
