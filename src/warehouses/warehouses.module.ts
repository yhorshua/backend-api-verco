import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Warehouse } from '../database/entities/warehouse.entity';
import { WarehousesService } from './warehouses.service';
import { WarehousesController } from './warehouses.controller';
import { RolesGuard } from '../auth/roles.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Warehouse])],
  controllers: [WarehousesController],
  providers: [WarehousesService, RolesGuard],
  exports: [WarehousesService],
})
export class WarehousesModule {}
