import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from "@nestjs/common";
import { EstadoCuentaService } from "./estado-cuenta.service";
import { RegistrarAbonoDto } from "./dto/registrarAbonoDto";
import { EstadoCuentaFiltroDto } from "./dto/estadoCuentaFilterDto";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";

@Controller('estado-cuenta')
export class EstadoCuentaController {
  constructor(
    private readonly service: EstadoCuentaService,
  ) { }

  @Get('cliente/:clienteId')
  getEstadoCuenta(
    @Param('clienteId') clienteId: number,
    @Query() filtro: EstadoCuentaFiltroDto,
  ) {
    return this.service.getEstadoCuentaCliente(
      Number(clienteId),
    );
  }

  @Post('abono')
  @UseGuards(JwtAuthGuard)
  registrarAbono(
    @Body()
    dto: RegistrarAbonoDto,
    @Request() req,
  ) {
    const userId =
      req.user?.userId ||
      req.user?.id ||
      req.user?.sub;
    return this.service.registrarAbono(
      dto,
      userId,
    );
  }
}