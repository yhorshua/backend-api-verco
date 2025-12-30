import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/CreateOrderDto';
import { ApproveOrderDto } from './dto/approve-order.dto';
import { RejectOrderDto } from './dto/reject-order.dto';
import { ListOrdersDto } from './dto/list-orders.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.service.createOrderAndReserveStock(dto);
  }

  @Get()
  list(@Query() q: ListOrdersDto) {
    return this.service.listOrders(q);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.service.getOrder(Number(id));
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @Body() dto: ApproveOrderDto) {
    return this.service.approveOrder(Number(id), dto.approved_by);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @Body() dto: RejectOrderDto) {
    return this.service.rejectOrder(Number(id), dto.rejected_by, dto.reason);
  }
}
