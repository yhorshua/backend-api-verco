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

@Module({
  imports: [TypeOrmModule.forFeature([GuiaInterna, GuiaInternaDetalle, EstadoCuenta, Order, OrderDetail, Product, EstadoCuentaHistorial, OrdersHistorial])],
  controllers: [GuiaInternaController],
  providers: [GuiaInternaService],
})
export class GuiaInternaModule {}
