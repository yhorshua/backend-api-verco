import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreditService } from './credit.service';
import { CreateAbonoDto } from './dto/create-abono.dto';
import { CreateCuotasDto } from './dto/create-cuotas.dto';

@Controller('estado-cuenta')
export class CreditController {
  constructor(private readonly service: CreditService) { }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.getEstadoCuenta(Number(id));
  }

  @Post('abono')
  createAbono(@Body() dto: CreateAbonoDto) {
    return this.service.registerAbono(dto);
  }

  /* ============================================================
     📆 CREAR CUOTAS MANUALMENTE
  ============================================================ */
  @Post('cuotas')
  crearCuotas(@Body() dto: CreateCuotasDto) {
    return this.service.crearCuotasManual(dto);
  }

  /* ============================================================
     📊 LISTAR CUOTAS POR ESTADO DE CUENTA
  ============================================================ */
  @Get(':id/cuotas')
  getCuotas(@Param('id') id: string) {
    return this.service.getCuotasByEstadoCuenta(Number(id));
  }
}
