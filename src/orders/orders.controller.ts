import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/CreateOrderDto';
import { ApproveOrderDto } from './dto/approve-order.dto';
import { RejectOrderDto } from './dto/reject-order.dto';
import { ListOrdersDto } from './dto/list-orders.dto';
import { ListOrdersAdvancedDto } from './dto/list-orders-advanced.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('orders')
export class OrdersController {
  constructor(private readonly service: OrdersService) { }

  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.service.createOrderAndReserveStock(dto);
  }

  @Get('by-role')
  @UseGuards(JwtAuthGuard)
  getByRole(
    @Query() q: ListOrdersAdvancedDto,
    @Req() req: any,
  ) {

    const userId =
      req.user?.userId ||
      req.user?.id ||
      req.user?.sub;

    const role =
      req.user?.role?.name_role ||
      req.user?.role;

    return this.service.listOrdersByUserAndRole(
      q,
      userId,
      role,
    );
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

  @Post(':id/delivered')
  async markAsDelivered(
    @Param('id') orderId: number,
    @Body() body: { user_id: number; notes?: string },
  ) {
    return this.service.markAsDelivered(
      Number(orderId),
      body.user_id,
      body.notes,
    );
  }
}
