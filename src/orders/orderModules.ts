/*import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OrdersService } from "./ordersService"; // 👈 faltaba
import { OrdersController } from "./orders.controller"; // 👈 faltaba

// Importa todas las entidades
import { Order } from "./entities/order.entity";
import { OrderDetail } from "./entities/order-detail.entity";
import { Stock } from "../stock/entities/stock.entity";
import { InventoryMovements } from "../stock/entities/stockMovements.entity";
import { OrdersHistorial } from "./entities/orders-historial.entity";
import { GuiaInterna } from "./entities/guia-interna.entity";
import { GuiaInternaDetails } from "./entities/guia-interna-details.entity";
import { Client } from "../clients/entity/client.entity";
import { Product } from "../products/entities/product.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderDetail,
      Stock,
      InventoryMovements,
      OrdersHistorial,
      GuiaInterna,
      GuiaInternaDetails,
      Client,
      Product,
    ]),
  ],
  providers: [OrdersService],
  controllers: [OrdersController],
})
export class OrdersModule {}*/