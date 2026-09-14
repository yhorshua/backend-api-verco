import { BadRequestException, Controller, Get, GoneException, Post, Body, Param, UseGuards, Req, Query } from '@nestjs/common';
import { StockService } from './stock.service';
import { CreateMovementDto } from './dto/create-movement.dto';
import { CreateSaleDto } from './dto/create-sale.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { StockMovementReportDto } from './dto/stockMovementReport.dto';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

type RegisterStockMultipleDto = {
  warehouseId: number;
  guideId?: number;
  guideNumber?: string;
  products: {
    productId: number;
    productSizeId: number;
    quantity: number;
  }[];
};

@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) { }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrador', 'Tienda')
  @Post('register-multiple')
  async registerStockForMultipleItems(
    @Body() stockDto: RegisterStockMultipleDto,
    @Req() req: any,
  ) {
    const { warehouseId, products, guideId, guideNumber } = stockDto;

    const userId =
      req.user?.userId ||
      req.user?.id ||
      req.user?.sub;

    return await this.stockService.registerStockForMultipleItems(
      Number(warehouseId),
      products,
      userId,
      guideId ? Number(guideId) : undefined,
      guideNumber,
    );
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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrador', 'Tienda')
  @Post('sale')
  registerSale(@Body() dto: CreateSaleDto, @Req() req: any) {
    const authenticatedUserId = Number(req.user?.userId);

    if (!Number.isInteger(authenticatedUserId) || authenticatedUserId < 1) {
      throw new BadRequestException('No se pudo identificar al usuario autenticado');
    }

    if (Number(dto.user_id) !== authenticatedUserId) {
      throw new BadRequestException(
        'El usuario de la venta no coincide con el usuario autenticado',
      );
    }

    return this.stockService.registerSale({
      ...dto,
      user_id: authenticatedUserId,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrador', 'Jefe Ventas')
  @Get('inventory/:warehouseId/category/:categoryId')
  getInventory(
    @Param('warehouseId') warehouseId: string,
    @Param('categoryId') categoryId: string,
  ) {
    return this.stockService.getInventoryByWarehouseAndCategory(
      +warehouseId,
      +categoryId,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrador')
  @Post('inventory/adjust')
  adjustInventory() {
    throw new GoneException(
      'Este endpoint fue reemplazado por POST /inventory-adjustments para garantizar motivo, auditoría y control de concurrencia',
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrador')
  @Get('movements/report')
  getStockMovementReport(
    @Query() filters: StockMovementReportDto
    ,
  ) {
    return this.stockService
      .getStockMovementReport(filters);
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
