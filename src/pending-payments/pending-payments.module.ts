import { Module } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { PendingPaymentsController } from './pending-payments.controller';
import { PendingPaymentsService } from './pending-payments.service';

@Module({
  controllers: [PendingPaymentsController],
  providers: [PendingPaymentsService, RolesGuard],
})
export class PendingPaymentsModule {}

