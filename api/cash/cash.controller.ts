import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CashService } from './cash.service';
import { OpenCashDto } from './dto/cash-open.dto';
import { ExpenseDto } from './dto/expense.dto';
import { CloseCashDto } from './dto/close-cash.dto';



@Controller('cash')
export class CashController {
  constructor(private readonly cashService: CashService) {}

  @Post('open')
  open(@Body() dto: OpenCashDto) {
    return this.cashService.openCash(dto);
  }

  @Get('status/:warehouseId')
  status(@Param('warehouseId') warehouseId: string) {
    return this.cashService.getStatus(Number(warehouseId));
  }

  @Get('movements/:sessionId')
  movements(@Param('sessionId') sessionId: string) {
    return this.cashService.getMovementsAndSummary(Number(sessionId));
  }

  @Post('expense')
  expense(@Body() dto: ExpenseDto) {
    return this.cashService.registerExpense(dto);
  }

  @Post('close')
  close(@Body() dto: CloseCashDto) {
    return this.cashService.closeCash(dto);
  }
}
