// src/reports/cash-movement.controller.ts

import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { SalesReportQueryDto } from './dto/sales-report.query.dto';

@Controller('cash-movements')
export class CashMovementController {
  constructor(private readonly reportsService: ReportsService) {}

  // Endpoint para obtener los gastos operativos dentro de un rango de fechas
 @Get('operating-expenses')
  async getOperatingExpenses(@Query() query: SalesReportQueryDto) {
    // Si no se pasa start o end, asignar valores predeterminados
    const start = query.start ? new Date(query.start) : new Date('2023-01-01');  // valor predeterminado
    const end = query.end ? new Date(query.end) : new Date();  // valor predeterminado: fecha actual

    return this.reportsService.getOperatingExpenses(start, end);
  }

}
