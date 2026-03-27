import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { CreateAbonoDto } from './dto/create-abono.dto';

import { EstadoCuenta } from '../database/entities/estado-cuenta.entity';
import { Abono } from '../database/entities/abono.entity';
import { EstadoCuentaHistorial } from '../database/entities/estado-cuenta-historial.entity';

import moment from 'moment-timezone';
import { CreateCuotasDto } from './dto/create-cuotas.dto';
import { Cuota } from 'src/database/entities/cuota.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class CreditService {
  constructor(
    private readonly ds: DataSource,

    @InjectRepository(EstadoCuenta)
    private readonly estadoRepo: Repository<EstadoCuenta>,

    @InjectRepository(Cuota)
    private readonly cuotaRepo: Repository<Cuota>,

    @InjectRepository(Abono)
    private readonly abonoRepo: Repository<Abono>,

    @InjectRepository(EstadoCuentaHistorial)
    private readonly estadoHistorialRepo: Repository<EstadoCuentaHistorial>,
  ) { }



  async getEstadoCuenta(id: number) {
    const estado = await this.ds.getRepository(EstadoCuenta).findOne({
      where: { id } as any,
    });

    if (!estado) throw new NotFoundException('EstadoCuenta no encontrado');

    const abonos = await this.ds.getRepository(Abono).find({
      where: { id_estado_cuenta: id } as any,
      order: { fecha_abono: 'ASC' } as any,
    });

    const historial = await this.ds.getRepository(EstadoCuentaHistorial).find({
      where: { id_estado_cuenta: id } as any,
      order: { fecha_registro: 'ASC' } as any,
    });

    return {
      estado,
      abonos,
      historial,
    };
  }

  async registerAbono(dto: CreateAbonoDto) {
    if (dto.monto_abono <= 0) {
      throw new BadRequestException('El monto del abono debe ser mayor a 0');
    }

    if (!['PEN', 'USD'].includes(dto.moneda_abono)) {
      throw new BadRequestException('Moneda inválida');
    }

    if (!dto.numero_operacion) {
      throw new BadRequestException('Debe enviar número de operación');
    }

    return this.ds.transaction(async (em) => {
      const estadoRepo = em.getRepository(EstadoCuenta);
      const abonoRepo = em.getRepository(Abono);
      const histRepo = em.getRepository(EstadoCuentaHistorial);
      const cuotaRepo = em.getRepository(Cuota);

      // 🔒 Validar operación duplicada
      const existeOperacion = await cuotaRepo.findOne({
        where: { numero_operacion: dto.numero_operacion },
      });

      if (existeOperacion) {
        throw new BadRequestException('El número de operación ya fue registrado');
      }

      const estado = await estadoRepo.findOne({
        where: {
          id: dto.id_estado_cuenta,
          cliente_id: dto.cliente_id,
        } as any,
        lock: { mode: 'pessimistic_write' },
      });

      if (!estado) {
        throw new NotFoundException('EstadoCuenta no encontrado');
      }

      if (Number(estado.monto_saldo) <= 0) {
        throw new BadRequestException('La deuda ya está cancelada');
      }

      const saldoAnterior = Number(estado.monto_saldo);
      const abono = parseFloat(dto.monto_abono.toString());

      if (abono > saldoAnterior) {
        throw new BadRequestException(
          `El abono excede el saldo pendiente. Saldo actual: ${saldoAnterior}`,
        );
      }

      const nowPeru = moment().tz('America/Lima').toDate();

      // 🔥 APLICAR ABONO A CUOTAS (FIFO)
      let montoRestante = abono;

      const cuotas = await cuotaRepo.find({
        where: { estado_cuenta_id: estado.id },
        order: { numero_cuota: 'ASC' },
      });

      for (const cuota of cuotas) {
        if (montoRestante <= 0) break;
        if (cuota.estado === 'PAGADO') continue;

        const saldoCuota = Number(cuota.saldo);

        if (montoRestante >= saldoCuota) {
          // paga toda la cuota
          cuota.monto_pagado = Number((cuota.monto_pagado + saldoCuota).toFixed(2));
          cuota.saldo = 0;
          cuota.estado = 'PAGADO';
          cuota.fecha_pago = nowPeru;
          cuota.numero_operacion = dto.numero_operacion;

          montoRestante -= saldoCuota;
        } else {
          // pago parcial
          cuota.monto_pagado = Number((cuota.monto_pagado + montoRestante).toFixed(2));
          cuota.saldo = Number((saldoCuota - montoRestante).toFixed(2));
          cuota.fecha_pago = nowPeru;
          cuota.numero_operacion = dto.numero_operacion;

          montoRestante = 0;
        }

        await cuotaRepo.save(cuota);
      }

      // ✅ Guardar abono
      await abonoRepo.save(
        abonoRepo.create({
          cliente_id: dto.cliente_id,
          monto_abono: abono,
          tipo_abono: dto.tipo_abono,
          moneda_abono: dto.moneda_abono,
          id_estado_cuenta: dto.id_estado_cuenta,
          fecha_abono: nowPeru,
        }),
      );

      // ✅ Actualizar estado general
      const pagoPrevio = Number(estado.monto_pago ?? 0);

      estado.monto_pago = Number((pagoPrevio + abono).toFixed(2));
      estado.monto_saldo = Number((saldoAnterior - abono).toFixed(2));

      estado.estado = estado.monto_saldo === 0 ? 'PAGADO' : 'PENDIENTE';

      await estadoRepo.save(estado);

      // ✅ Historial
      await histRepo.save(
        histRepo.create({
          id_estado_cuenta: dto.id_estado_cuenta,
          monto_abono: abono,
          saldo_anterior: saldoAnterior,
          saldo_nuevo: estado.monto_saldo,
          usuario_id: dto.usuario_id,
          fecha_registro: nowPeru,
        }),
      );

      // 🎯 RESPUESTA FINAL
      return {
        ok: true,
        mensaje: 'Abono aplicado correctamente',
        data: {
          cliente_id: estado.cliente_id,
          estado_cuenta_id: estado.id,
          total_deuda: estado.monto_inicial,
          total_pagado: estado.monto_pago,
          saldo_restante: estado.monto_saldo,
          estado: estado.estado,
        },
      };
    });
  }

  async crearCuotasManual(dto: CreateCuotasDto) {
    return this.ds.transaction(async (em) => {
      const cuotaRepo = em.getRepository(Cuota);
      const estadoRepo = em.getRepository(EstadoCuenta);

      const estado = await estadoRepo.findOne({
        where: { id: dto.estado_cuenta_id } as any,
      });

      if (!estado) {
        throw new NotFoundException('EstadoCuenta no encontrado');
      }

      // 🔒 Validar que no existan cuotas previas
      const existentes = await cuotaRepo.count({
        where: { estado_cuenta_id: dto.estado_cuenta_id },
      });

      if (existentes > 0) {
        throw new BadRequestException('Ya existen cuotas para este crédito');
      }

      // 🧠 Validar total de cuotas = deuda
      const totalCuotas = dto.cuotas.reduce((acc, c) => acc + Number(c.monto), 0);

      if (Number(totalCuotas.toFixed(2)) !== Number(estado.monto_inicial)) {
        throw new BadRequestException('La suma de cuotas no coincide con el monto total');
      }

      const cuotas = dto.cuotas.map(c => {
        return cuotaRepo.create({
          estado_cuenta_id: dto.estado_cuenta_id, // 👈 ahora sí válido
          numero_cuota: c.numero_cuota,
          monto: c.monto,
          saldo: c.monto,
          fecha_vencimiento: moment.tz(c.fecha_vencimiento, 'America/Lima').toDate(),
          numero_operacion: c.numero_operacion || undefined, // 👈 clave aquí
          estado: 'PENDIENTE',
        });
      });

      await cuotaRepo.save(cuotas);

      return {
        ok: true,
        message: 'Cuotas creadas correctamente',
        total_cuotas: cuotas.length,
      };
    });
  }

  async getCuotasByEstadoCuenta(id: number) {
    const cuotas = await this.ds.getRepository(Cuota).find({
      where: { estado_cuenta_id: id },
      order: { numero_cuota: 'ASC' },
    });

    return cuotas.map(c => ({
      cuota: c.numero_cuota,
      monto: c.monto,
      saldo: c.saldo,
      estado: c.estado,
      fecha_vencimiento: c.fecha_vencimiento,
      fecha_pago: c.fecha_pago,
      numero_operacion: c.numero_operacion,
    }));
  }
}

