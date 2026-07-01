// src/reports/cash-movement.controller.ts

import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { SalesReportQueryDto } from './dto/sales-report.query.dto';

@Controller('cash-movements')
export class CashMovementController {
  constructor(private readonly reportsService: ReportsService) { }


  private addOneDay(dateISO: string): string {
    const [year, month, day] = dateISO.split('-').map(Number);

    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + 1);

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');

    return `${yyyy}-${mm}-${dd}`;
  }

  private formatDateOnly(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');

    return `${yyyy}-${mm}-${dd}`;
  }

  // Endpoint para obtener los gastos operativos dentro de un rango de fechas
  @Get('operating-expenses')
  async getOperatingExpenses(@Query() query: SalesReportQueryDto) {
    const startDate = query.start || '2023-01-01';
    const endDate = query.end || this.formatDateOnly(new Date());

    const start = `${startDate} 00:00:00.000`;
    const endExclusive = `${this.addOneDay(endDate)} 00:00:00.000`;

    return this.reportsService.getOperatingExpenses(start, endExclusive);
  }

}
