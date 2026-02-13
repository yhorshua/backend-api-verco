import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { SalesReportQueryDto } from './dto/sales-report.query.dto';
import { JwtAuthGuard } from 'api/auth/jwt-auth.guard';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) { }

  // Ejemplos:
  // /reports/sales?warehouseId=1&type=DAY&date=2025-12-28
  // /reports/sales?warehouseId=1&type=RANGE&from=2025-12-01&to=2025-12-07
  // /reports/sales?warehouseId=1&type=RANGE&from=2025-12-01&to=2025-12-31&userId=12
  @UseGuards(JwtAuthGuard)
  @Get('sales')
  sales(@Query() dto: SalesReportQueryDto) {
    return this.reportsService.salesReport(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('cash-closure')
  async getCashClosureReport(@Query() query: SalesReportQueryDto) {
    return this.reportsService.getCashClosureReport(query);
  }

  // Reporte de ingresos de mercancía
  @UseGuards(JwtAuthGuard)
  @Get('inventory-ingress')
  async getInventoryIngressReport(@Query() query: SalesReportQueryDto) {
    return this.reportsService.getInventoryIngressReport(query);
  }

  // Reporte de utilidad semanal
  @UseGuards(JwtAuthGuard)
  @Get('weekly-profit')
  async getWeeklyProfitReport(@Query() query: SalesReportQueryDto) {
    return this.reportsService.getWeeklyProfitReport(query);
  }

  // Reporte de comisiones por vendedor (pares de zapatillas vendidos)
  @UseGuards(JwtAuthGuard)
  @Get('seller-commission')
  async getSellerCommissionReport(@Query() query: SalesReportQueryDto) {
    return this.reportsService.getSellerCommissionReport(query);
  }
}
