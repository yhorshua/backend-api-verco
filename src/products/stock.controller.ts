import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { StockService } from './stock.service';
import { CreateMovementDto } from './dto/create-movement.dto';
import { CreateSaleDto } from './dto/create-sale.dto';

@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get('warehouse/:warehouseId')
  getStockByWarehouse(@Param('warehouseId') warehouseId: string) {
    return this.stockService.getStockByWarehouse(+warehouseId);
  }

  @Post('incoming')
  registerIncoming(@Body() dto: CreateMovementDto) {
    return this.stockService.registerIncoming(dto);
  }

  @Post('sale')
  registerSale(@Body() dto: CreateSaleDto) {
    return this.stockService.registerSale(dto);
  }

  @Post('return')
  registerReturn(@Body() dto: CreateMovementDto) {
    return this.stockService.registerReturn(dto);
  }

  @Get('report/day/:date')
  getMovementsByDay(@Param('date') date: string) {
    return this.stockService.getMovementsByDay(date);
  }

  @Get('report/month/:year/:month')
  getMovementsByMonth(@Param('year') year: string, @Param('month') month: string) {
    return this.stockService.getMovementsByMonth(+year, +month);
  }
}