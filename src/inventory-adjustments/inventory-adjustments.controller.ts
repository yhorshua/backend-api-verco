import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateInventoryAdjustmentDto } from './dto/create-inventory-adjustment.dto';
import {
  AdjustmentUser,
  InventoryAdjustmentsService,
} from './inventory-adjustments.service';

@Controller('inventory-adjustments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Administrador', 'Jefe Ventas')
export class InventoryAdjustmentsController {
  constructor(private readonly service: InventoryAdjustmentsService) {}

  @Get('warehouses')
  listWarehouses(@Req() request: { user: AdjustmentUser }) {
    return this.service.listAllowedWarehouses(request.user);
  }

  @Get('warehouses/:warehouseId/inventory')
  getInventory(
    @Param('warehouseId', ParseIntPipe) warehouseId: number,
    @Req() request: { user: AdjustmentUser },
  ) {
    return this.service.getWarehouseInventory(warehouseId, request.user);
  }

  @Post()
  create(
    @Body() dto: CreateInventoryAdjustmentDto,
    @Req() request: { user: AdjustmentUser; ip?: string },
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.service.create(dto, request.user, {
      correlationId,
      ip: request.ip,
    });
  }

  @Get(':operationId')
  getOperation(
    @Param('operationId', ParseIntPipe) operationId: number,
    @Req() request: { user: AdjustmentUser },
  ) {
    return this.service.getOperation(operationId, request.user);
  }
}
