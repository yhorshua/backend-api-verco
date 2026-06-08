import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Abono } from "src/database/entities/abono.entity";
import { Client } from "src/database/entities/client.entity";
import { EstadoCuenta } from "src/database/entities/estado-cuenta.entity";
import { GuiaInterna } from "src/database/entities/guia-interna.entity";
import { EstadoCuentaController } from "./estado-cuenta.controller";
import { EstadoCuentaService } from "./estado-cuenta.service";
import { AbonoDetalle } from "src/database/entities/abonoDetalle.entity";
import { EstadoCuentaHistorial } from "src/database/entities/estado-cuenta-historial.entity";
import { Cuota } from "src/database/entities/cuota.entity";
import { SaldoFavorCliente } from "src/database/entities/saldoFavorCliente";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EstadoCuenta,
      Abono,
      Client,
      GuiaInterna,
      AbonoDetalle,
      EstadoCuentaHistorial,
      Cuota,
      SaldoFavorCliente,
    ]),
  ],
  controllers: [EstadoCuentaController],
  providers: [EstadoCuentaService],
})
export class EstadoCuentaModule {}