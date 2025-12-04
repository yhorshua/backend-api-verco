/*import { Controller, Param, Post, UseGuards, Body, Request } from "@nestjs/common";
import { CreateOrderDto } from "./dto/CreateOrderDto";
import { Roles } from "src/auth/roles.decorator";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { RolesGuard } from "src/auth/roles.guard";
import { OrdersService } from "./orders.service"; // 👈 faltaba

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendedor')
  @Post()
  createOrder(@Body() dto: CreateOrderDto, @Request() req) {
    return this.ordersService.create(dto, req.user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('jefe_ventas')
  @Post(':id/approve')
  approve(@Param('id') id: number, @Request() req) {
    return this.ordersService.approve(id, req.user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('jefe_ventas')
  @Post(':id/reject')
  reject(@Param('id') id: number, @Request() req) {
    return this.ordersService.reject(id, req.user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('logistica', 'jefe_ventas')
  @Post(':id/internal-guide')
  generateInternalGuide(@Param('id') id: number, @Request() req) {
    return this.ordersService.generateInternalGuide(id, req.user.userId);
  }
}*/