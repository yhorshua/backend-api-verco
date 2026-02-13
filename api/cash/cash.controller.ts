import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CashService } from './cash.service';
import { OpenCashDto } from './dto/cash-open.dto';
import { ExpenseDto } from './dto/expense.dto';
import { CloseCashDto } from './dto/close-cash.dto';
import { JwtAuthGuard } from 'api/auth/jwt-auth.guard';



@Controller('cash')
export class CashController {
  constructor(private readonly cashService: CashService) { }

  @UseGuards(JwtAuthGuard)
  @Post('open')
  open(@Body() dto: OpenCashDto) {
    return this.cashService.openCash(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('status/:warehouseId')
  status(@Param('warehouseId') warehouseId: string) {
    return this.cashService.getStatus(Number(warehouseId));
  }

  @UseGuards(JwtAuthGuard)
  @Get('movements/:sessionId')
  movements(@Param('sessionId') sessionId: string) {
    return this.cashService.getMovementsAndSummary(Number(sessionId));
  }

  @UseGuards(JwtAuthGuard)
  @Post('expense')
  expense(@Body() dto: ExpenseDto) {
    return this.cashService.registerExpense(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('close')
  close(@Body() dto: CloseCashDto) {
    return this.cashService.closeCash(dto);
  }
}
