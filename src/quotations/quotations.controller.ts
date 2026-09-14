import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CancelQuotationDto } from './dto/cancel-quotation.dto';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { QuotationsService } from './quotations.service';

@Controller('quotations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Administrador', 'Jefe Ventas', 'Vendedor', 'Vendedor Web', 'Tienda')
export class QuotationsController {
  constructor(private readonly service: QuotationsService) {}

  @Post()
  create(@Body() dto: CreateQuotationDto, @Req() req: any) {
    return this.service.create(dto, req.user);
  }

  @Get('reports/summary')
  @Roles('Administrador', 'Jefe Ventas')
  report(@Query() query: Record<string, string>, @Req() req: any) {
    return this.service.report(query, req.user);
  }

  @Get()
  list(@Query() query: Record<string, string>, @Req() req: any) {
    return this.service.list(query, req.user);
  }

  @Get(':id')
  get(@Param('id') id: string, @Req() req: any) {
    return this.service.getById(Number(id), req.user);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Body() dto: CancelQuotationDto, @Req() req: any) {
    return this.service.cancel(Number(id), dto.reason, req.user);
  }
}
