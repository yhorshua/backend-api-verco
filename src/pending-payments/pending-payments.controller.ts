import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ListPendingPaymentsDto } from './dto/list-pending-payments.dto';
import { RegisterCreditPaymentDto } from './dto/register-credit-payment.dto';
import {
  PaymentUser,
  PendingPaymentsService,
} from './pending-payments.service';

@Controller('pending-payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Administrador', 'Tienda')
export class PendingPaymentsController {
  constructor(private readonly service: PendingPaymentsService) {}

  @Get()
  list(
    @Query() query: ListPendingPaymentsDto,
    @Req() request: { user: PaymentUser },
  ) {
    return this.service.list(query, request.user);
  }

  @Get('count')
  count(@Req() request: { user: PaymentUser }) {
    return this.service.count(request.user);
  }

  @Get(':saleId')
  detail(
    @Param('saleId', ParseIntPipe) saleId: number,
    @Req() request: { user: PaymentUser },
  ) {
    return this.service.detail(saleId, request.user);
  }

  @Post(':saleId/payments')
  registerPayment(
    @Param('saleId', ParseIntPipe) saleId: number,
    @Body() dto: RegisterCreditPaymentDto,
    @Req() request: { user: PaymentUser },
  ) {
    return this.service.registerPayment(saleId, dto, request.user);
  }
}
