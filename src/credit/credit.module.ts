import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditController } from './credit.controller';
import { CreditService } from './credit.service';

import { EstadoCuenta } from '../database/entities/estado-cuenta.entity';
import { Abono } from '../database/entities/abono.entity';
import { EstadoCuentaHistorial } from '../database/entities/estado-cuenta-historial.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EstadoCuenta, Abono, EstadoCuentaHistorial])],
  controllers: [CreditController],
  providers: [CreditService],
})
export class CreditModule {}
