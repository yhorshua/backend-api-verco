import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateAbonoDto } from './dto/create-abono.dto';

import { EstadoCuenta } from '../database/entities/estado-cuenta.entity';
import { Abono } from '../database/entities/abono.entity';
import { EstadoCuentaHistorial } from '../database/entities/estado-cuenta-historial.entity';

@Injectable()
export class CreditService {
  constructor(private readonly ds: DataSource) {}

  async getEstadoCuenta(id: number) {
    const estado = await this.ds.getRepository(EstadoCuenta).findOne({ where: { id } as any });
    if (!estado) throw new NotFoundException('EstadoCuenta no encontrado');

    const abonos = await this.ds.getRepository(Abono).find({
      where: { id_estado_cuenta: id } as any,
      order: { fecha_abono: 'ASC' } as any,
    });

    const historial = await this.ds.getRepository(EstadoCuentaHistorial).find({
      where: { id_estado_cuenta: id } as any,
      order: { fecha_registro: 'ASC' } as any,
    });

    return { estado, abonos, historial };
  }

  async registerAbono(dto: CreateAbonoDto) {
    if (dto.monto_abono <= 0) throw new BadRequestException('monto_abono debe ser > 0');

    return this.ds.transaction(async (em) => {
      const estadoRepo = em.getRepository(EstadoCuenta);
      const abonoRepo = em.getRepository(Abono);
      const histRepo = em.getRepository(EstadoCuentaHistorial);

      const estado = await estadoRepo.findOne({
        where: { id: dto.id_estado_cuenta, cliente_id: dto.cliente_id } as any,
        lock: { mode: 'pessimistic_write' },
      });
      if (!estado) throw new NotFoundException('EstadoCuenta no encontrado');

      const saldoAnterior = Number(estado.monto_saldo);
      const ab = Number(dto.monto_abono);

      if (ab > saldoAnterior) {
        throw new BadRequestException(`El abono excede el saldo. Saldo=${saldoAnterior}`);
      }

      // guardar abono
      await abonoRepo.save(
        abonoRepo.create({
          cliente_id: dto.cliente_id,
          monto_abono: ab,
          tipo_abono: dto.tipo_abono,
          moneda_abono: dto.moneda_abono,
          id_estado_cuenta: dto.id_estado_cuenta,
        }),
      );

      // actualizar estado
      const pagoPrev = Number(estado.monto_pago ?? 0);
      estado.monto_pago = Number((pagoPrev + ab).toFixed(2));
      estado.monto_saldo = Number((saldoAnterior - ab).toFixed(2));
      await estadoRepo.save(estado);

      // historial
      await histRepo.save(
        histRepo.create({
          id_estado_cuenta: dto.id_estado_cuenta,
          monto_abono: ab,
          saldo_anterior: saldoAnterior,
          saldo_nuevo: estado.monto_saldo,
          usuario_id: dto.usuario_id,
        }),
      );

      return { ok: true, estado };
    });
  }
}
