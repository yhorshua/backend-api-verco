import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreditService } from './credit.service';
import { CreateAbonoDto } from './dto/create-abono.dto';

@Controller('estado-cuenta')
export class CreditController {
  constructor(private readonly service: CreditService) {}

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.getEstadoCuenta(Number(id));
  }

  @Post('abono')
  createAbono(@Body() dto: CreateAbonoDto) {
    return this.service.registerAbono(dto);
  }
}
