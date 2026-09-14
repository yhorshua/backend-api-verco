// src/dashboard/dashboard.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DashboardGateway } from './dashboard.gateway';
import { DashboardCountersService } from './dashCounter.service';
import { DashboardCountersController } from './dashCounter.controller';
import { DashboardEventsListener } from './dashboard-events.listener';

import { WebSale } from '../database/entities/webSale.entity';
import { Order } from '../database/entities/orders.entity';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { RolesGuard } from '../auth/roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WebSale,
      Order,
    ]),
    AuthModule,
    UsersModule,
  ],
  controllers: [
    DashboardCountersController,
  ],
  providers: [
    DashboardGateway,
    DashboardCountersService,
    DashboardEventsListener,
    RolesGuard,
  ],
  exports: [
    DashboardGateway,
    DashboardCountersService,
  ],
})
export class DashboardModule {}
