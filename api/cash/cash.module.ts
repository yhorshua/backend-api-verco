// src/cash/cash.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashController } from './cash.controller';
import { CashService } from './cash.service';
import { CashRegisterSession } from '../database/entities/cash-register-session.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CashRegisterSession])],
  controllers: [CashController],
  providers: [CashService],
  exports: [CashService],
})
export class CashModule {}
