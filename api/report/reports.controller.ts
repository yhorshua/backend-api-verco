import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { SalesReportQueryDto } from './dto/sales-report.query.dto';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // Ejemplos:
  // /reports/sales?warehouseId=1&type=DAY&date=2025-12-28
  // /reports/sales?warehouseId=1&type=RANGE&from=2025-12-01&to=2025-12-07
  // /reports/sales?warehouseId=1&type=RANGE&from=2025-12-01&to=2025-12-31&userId=12
  @Get('sales')
  sales(@Query() dto: SalesReportQueryDto) {
    return this.reportsService.salesReport(dto);
  }
}
