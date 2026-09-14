import { Module } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { InventoryAdjustmentsController } from './inventory-adjustments.controller';
import { InventoryAdjustmentsService } from './inventory-adjustments.service';

@Module({
  controllers: [InventoryAdjustmentsController],
  providers: [InventoryAdjustmentsService, RolesGuard],
  exports: [InventoryAdjustmentsService],
})
export class InventoryAdjustmentsModule {}
