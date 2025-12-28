// src/cash/cash.controller.ts
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CashService } from './cash.service';
import { OpenCashDto } from './dto/cash-open.dto';

@Controller('cash')
export class CashController {
  constructor(private readonly cashService: CashService) {}

  @Post('open')
  openCash(@Body() dto: OpenCashDto) {
    return this.cashService.openCash(dto);
  }

  @Get('open/:warehouseId')
  getOpenCash(@Param('warehouseId') warehouseId: string) {
    return this.cashService.getOpenSessionByWarehouse(Number(warehouseId));
  }
}
