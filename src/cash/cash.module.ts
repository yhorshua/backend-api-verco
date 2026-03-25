// cash.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CashRegisterSession } from '../database/entities/cash-register-session.entity';
import { CashMovement } from '../database/entities/cash-movement.entity';

import { CashController } from './cash.controller';
import { CashService } from './cash.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CashRegisterSession, CashMovement]), // ✅ IMPORTANTE
  ],
  controllers: [CashController],
  providers: [CashService],
  exports: [CashService], // opcional (solo si otros módulos lo usan)
})
export class CashModule {}
