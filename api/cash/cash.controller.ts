import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CashService } from './cash.service';
import { OpenCashDto } from './dto/cash-open.dto';
import { ExpenseDto } from './dto/expense.dto';
import { CloseCashDto } from './dto/close-cash.dto';

// Si ya manejas guards/roles, los aplicas aquí:
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('cash')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CashController {
  constructor(private readonly cashService: CashService) {}

  // Solo un rol autorizado puede abrir/cerrar caja (ajústalo)
  @Roles('admin', 'encargado', 'vendedor')
  @Post('open')
  open(@Body() dto: OpenCashDto) {
    return this.cashService.openCash(dto);
  }

  @Roles('admin', 'encargado', 'vendedor')
  @Get('status/:warehouseId')
  status(@Param('warehouseId') warehouseId: string) {
    return this.cashService.getStatus(Number(warehouseId));
  }

  @Roles('admin', 'encargado', 'vendedor')
  @Get('movements/:sessionId')
  movements(@Param('sessionId') sessionId: string) {
    return this.cashService.getMovementsAndSummary(Number(sessionId));
  }

  @Roles('admin', 'encargado', 'vendedor')
  @Post('expense')
  expense(@Body() dto: ExpenseDto) {
    return this.cashService.registerExpense(dto);
  }

  @Roles('admin', 'encargado') // normalmente solo encargado/admin cierra
  @Post('close')
  close(@Body() dto: CloseCashDto) {
    return this.cashService.closeCash(dto);
  }
}
