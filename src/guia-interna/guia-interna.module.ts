import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuiaInternaController } from './guia-interna.controller';
import { GuiaInternaService } from './guia-interna.service';

import { GuiaInterna } from '../database/entities/guia-interna.entity';
import { GuiaInternaDetalle } from '../database/entities/guia-interna-detalle.entity';
import { EstadoCuenta } from '../database/entities/estado-cuenta.entity';

import { Order } from '../database/entities/orders.entity';
import { OrderDetail } from '../database/entities/order-details.entity';
import { Product } from '../database/entities/product.entity';
import { OrdersHistorial } from 'src/database/entities/orders-historial.entity';
import { EstadoCuentaHistorial } from 'src/database/entities/estado-cuenta-historial.entity';
import { GuiaInternaDevolucion } from 'src/database/entities/guia-interna-devolucion.entity';
import { GuiaInternaDevolucionDetalle } from 'src/database/entities/guia-interna-devolucion-detalle.entity';
import { Stock } from 'src/database/entities/stock.entity';
import { StockMovement } from 'src/database/entities/stock-movements';

@Module({
  imports: [TypeOrmModule.forFeature([GuiaInterna,
    GuiaInternaDetalle,
    GuiaInternaDevolucion,
    GuiaInternaDevolucionDetalle,
    EstadoCuenta,
    EstadoCuentaHistorial,
    Order,
    OrderDetail,
    OrdersHistorial,
    Product,
    Stock,
    StockMovement,])],
  controllers: [GuiaInternaController],
  providers: [GuiaInternaService],
})
export class GuiaInternaModule { }
