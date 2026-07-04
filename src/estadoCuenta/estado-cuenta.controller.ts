import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { EstadoCuentaService } from './estado-cuenta.service';
import { RegistrarAbonoEstadoCuentaDto } from './dto/registrarAbonoDto';

@Controller('estado-cuenta')
export class EstadoCuentaController {
  constructor(private readonly service: EstadoCuentaService) {}

  @Get('cliente/:clienteId')
  getEstadoCuentaCliente(@Param('clienteId', ParseIntPipe) clienteId: number) {
    return this.service.getEstadoCuentaCliente(clienteId);
  }

  @Get(':id')
  getDetalleEstadoCuenta(@Param('id', ParseIntPipe) id: number) {
    return this.service.getDetalleEstadoCuenta(id);
  }

  @Post('abono')
  registrarAbono(@Body() dto: RegistrarAbonoEstadoCuentaDto) {
    return this.service.registrarAbono(dto);
  }
}