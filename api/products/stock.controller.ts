import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { StockService } from './stock.service';
import { CreateMovementDto } from './dto/create-movement.dto';
import { CreateSaleDto } from './dto/create-sale.dto';
import { JwtAuthGuard } from 'api/auth/jwt-auth.guard';

@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) { }

  @UseGuards(JwtAuthGuard)
  @Post('register-multiple')
  async registerStockForMultipleItems(
    @Body() stockDto: { warehouseId: number; products: {  productId: number; productSizeId: number; quantity: number }[] }
  ) {
    const { warehouseId, products } = stockDto;
    return await this.stockService.registerStockForMultipleItems(warehouseId, products);
  }

  @UseGuards(JwtAuthGuard)
  @Get('by-warehouse/:warehouseId/article/:articleCode')
  getByWarehouseAndArticle(
    @Param('warehouseId') warehouseId: string,
    @Param('articleCode') articleCode: string,
  ) {
    return this.stockService.getProductStockByWarehouseAndArticleCode(
      +warehouseId,
      articleCode,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('sale')
  registerSale(@Body() dto: CreateSaleDto) {
    return this.stockService.registerSale(dto);
  }

  /*
    @Post('incoming')
    registerIncoming(@Body() dto: CreateMovementDto) {
      return this.stockService.registerIncoming(dto);
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
      */
}