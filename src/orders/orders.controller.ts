import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/CreateOrderDto';
import { RejectOrderDto } from './dto/reject-order.dto';
import { ListOrdersDto } from './dto/list-orders.dto';
import { ListOrdersAdvancedDto } from './dto/list-orders-advanced.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly service: OrdersService) { }

  @Post()
  @Roles('Administrador', 'Jefe Ventas', 'Vendedor', 'Vendedor Web')
  create(@Body() dto: CreateOrderDto, @Req() req: any) {
    return this.service.createOrderAndReserveStock(dto, req.user);
  }

  @Get('by-role')
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
  @Roles('Administrador', 'Jefe Ventas')
  list(@Query() q: ListOrdersDto) {
    return this.service.listOrders(q);
  }
  @Get(':id')
  @Roles('Administrador', 'Jefe Ventas', 'Vendedor', 'Vendedor Web')
  getOne(@Param('id') id: string, @Req() req: any) {
    return this.service.getOrderForUser(Number(id), req.user);
  }

  @Post(':id/approve')
  @Roles('Administrador', 'Jefe Ventas')
  approve(@Param('id') id: string, @Req() req: any) {
    return this.service.approveOrder(Number(id), Number(req.user.userId));
  }

  @Post(':id/reject')
  @Roles('Administrador', 'Jefe Ventas')
  reject(@Param('id') id: string, @Body() dto: RejectOrderDto, @Req() req: any) {
    return this.service.rejectOrder(Number(id), Number(req.user.userId), dto.reason);
  }

  @Post(':id/delivered')
  @Roles('Administrador', 'Jefe Ventas', 'Delivery')
  async markAsDelivered(
    @Param('id') orderId: number,
    @Body() body: { notes?: string },
    @Req() req: any,
  ) {
    return this.service.markAsDelivered(
      Number(orderId),
      Number(req.user.userId),
      body.notes,
    );
  }

  @Get('report/sales')
  @Roles('Administrador', 'Jefe Ventas', 'Vendedor Web')
  getSalesReport(@Query() query: any, @Req() req: any) {
    return this.service.getSalesReport({
      fecha_inicio: query.fecha_inicio,
      fecha_fin: query.fecha_fin,
      vendedor_id: req.user.role === 'Vendedor Web'
        ? Number(req.user.userId)
        : query.vendedor_id ? Number(query.vendedor_id) : undefined,
    });
  }
}
