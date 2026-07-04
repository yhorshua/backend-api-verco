import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import {
  EstadoCuenta,
  EstadoCuentaEnum,
} from '../database/entities/estado-cuenta.entity';
import {
  EstadoCuentaHistorial,
  TipoMovimientoCuentaEnum,
} from '../database/entities/estado-cuenta-historial.entity';

@Injectable()
export class EstadoCuentaService {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(EstadoCuenta)
    private readonly estadoCuentaRepo: Repository<EstadoCuenta>,

    @InjectRepository(EstadoCuentaHistorial)
    private readonly historialRepo: Repository<EstadoCuentaHistorial>,
  ) {}

  async getEstadoCuentaCliente(clienteId: number) {
    const cuentas = await this.estadoCuentaRepo
      .createQueryBuilder('ec')
      .leftJoinAndSelect('ec.cliente', 'cliente')
      .leftJoinAndSelect('ec.vendedor', 'vendedor')
      .leftJoinAndSelect('ec.guia_interna', 'guia')
      .where('ec.cliente_id = :clienteId', { clienteId })
      .orderBy('ec.fecha_registro', 'DESC')
      .getMany();

    const resumen = {
      total_documentos: cuentas.length,
      total_deuda: 0,
      total_pagado: 0,
      total_saldo: 0,
      pendientes: 0,
      parciales: 0,
      pagados: 0,
    };

    const documentos = cuentas.map((cuenta) => {
      const montoInicial = Number(cuenta.monto_inicial || 0);
      const montoPago = Number(cuenta.monto_pago || 0);
      const montoSaldo = Number(cuenta.monto_saldo || 0);

      resumen.total_deuda += montoInicial;
      resumen.total_pagado += montoPago;
      resumen.total_saldo += montoSaldo;

      if (cuenta.estado === EstadoCuentaEnum.PENDIENTE) resumen.pendientes += 1;
      if (cuenta.estado === EstadoCuentaEnum.PARCIAL) resumen.parciales += 1;
      if (cuenta.estado === EstadoCuentaEnum.PAGADO) resumen.pagados += 1;

      return {
        id_estado_cuenta: cuenta.id,
        id_guia_interna: cuenta.id_guia_interna,
        guia: cuenta.guia_interna
          ? {
              id: cuenta.guia_interna.id,
              proforma_number: cuenta.guia_interna.proforma_number,
              fecha_registro: cuenta.guia_interna.fecha_registro,
              total_precio: Number(cuenta.guia_interna.total_precio || 0),
            }
          : null,
        vendedor: cuenta.vendedor
          ? {
              id: cuenta.vendedor.id,
              nombre: (cuenta.vendedor as any).full_name ?? '',
            }
          : null,
        monto_inicial: montoInicial,
        monto_pago: montoPago,
        monto_saldo: montoSaldo,
        estado: cuenta.estado,
        tipo_credito: cuenta.tipo_credito,
        fecha_registro: cuenta.fecha_registro,
        fecha_vencimiento: cuenta.fecha_vencimiento,
        dias_credito: cuenta.dias_credito,
      };
    });

    resumen.total_deuda = Number(resumen.total_deuda.toFixed(2));
    resumen.total_pagado = Number(resumen.total_pagado.toFixed(2));
    resumen.total_saldo = Number(resumen.total_saldo.toFixed(2));

    return {
      cliente_id: clienteId,
      resumen,
      documentos,
    };
  }

  async getDetalleEstadoCuenta(idEstadoCuenta: number) {
    const cuenta = await this.estadoCuentaRepo
      .createQueryBuilder('ec')
      .leftJoinAndSelect('ec.cliente', 'cliente')
      .leftJoinAndSelect('ec.vendedor', 'vendedor')
      .leftJoinAndSelect('ec.guia_interna', 'guia')
      .where('ec.id = :idEstadoCuenta', { idEstadoCuenta })
      .getOne();

    if (!cuenta) {
      throw new NotFoundException('Estado de cuenta no encontrado');
    }

    const historial = await this.historialRepo.find({
      where: {
        id_estado_cuenta: idEstadoCuenta,
      },
      order: {
        fecha_registro: 'DESC',
      },
    });

    return {
      cuenta: {
        id_estado_cuenta: cuenta.id,
        cliente_id: cuenta.cliente_id,
        vendedor_id: cuenta.vendedor_id,
        id_guia_interna: cuenta.id_guia_interna,
        monto_inicial: Number(cuenta.monto_inicial || 0),
        monto_pago: Number(cuenta.monto_pago || 0),
        monto_saldo: Number(cuenta.monto_saldo || 0),
        estado: cuenta.estado,
        tipo_credito: cuenta.tipo_credito,
        fecha_registro: cuenta.fecha_registro,
        fecha_vencimiento: cuenta.fecha_vencimiento,
        dias_credito: cuenta.dias_credito,
      },
      historial: historial.map((h) => ({
        id_historial: h.id,
        tipo_movimiento: h.tipo_movimiento,
        monto_abono: Number(h.monto_abono || 0),
        saldo_anterior: h.saldo_anterior !== null ? Number(h.saldo_anterior) : null,
        saldo_nuevo: h.saldo_nuevo !== null ? Number(h.saldo_nuevo) : null,
        metodo_pago: h.metodo_pago,
        numero_operacion: h.numero_operacion,
        fecha_pago: h.fecha_pago,
        observacion: h.observacion,
        comprobante_url: h.comprobante_url,
        usuario_id: h.usuario_id,
        fecha_registro: h.fecha_registro,
      })),
    };
  }

  async registrarAbono(dto: {
    id_estado_cuenta: number;
    monto_abono: number;
    usuario_id: number;
    metodo_pago?: string;
    numero_operacion?: string;
    fecha_pago?: string;
    observacion?: string;
    comprobante_url?: string;
  }) {
    if (!dto.id_estado_cuenta) {
      throw new BadRequestException('id_estado_cuenta es requerido');
    }

    if (!dto.usuario_id) {
      throw new BadRequestException('usuario_id es requerido');
    }

    const montoAbono = Number(dto.monto_abono);

    if (!Number.isFinite(montoAbono) || montoAbono <= 0) {
      throw new BadRequestException('El monto abonado debe ser mayor a 0');
    }

    return this.dataSource.transaction(async (manager) => {
      const estadoCuentaRepo = manager.getRepository(EstadoCuenta);
      const historialRepo = manager.getRepository(EstadoCuentaHistorial);

      const cuenta = await estadoCuentaRepo.findOne({
        where: {
          id: dto.id_estado_cuenta,
        },
        lock: {
          mode: 'pessimistic_write',
        },
      });

      if (!cuenta) {
        throw new NotFoundException('Estado de cuenta no encontrado');
      }

      if (cuenta.estado === EstadoCuentaEnum.PAGADO) {
        throw new BadRequestException('La cuenta ya se encuentra pagada');
      }

      const saldoAnterior = Number(cuenta.monto_saldo || 0);

      if (montoAbono > saldoAnterior) {
        throw new BadRequestException(
          `El abono no puede ser mayor al saldo pendiente. Saldo actual: ${saldoAnterior}`,
        );
      }

      const montoPagoAnterior = Number(cuenta.monto_pago || 0);
      const nuevoMontoPago = Number((montoPagoAnterior + montoAbono).toFixed(2));
      const saldoNuevo = Number((saldoAnterior - montoAbono).toFixed(2));

      cuenta.monto_pago = nuevoMontoPago;
      cuenta.monto_saldo = saldoNuevo;

      if (saldoNuevo === 0) {
        cuenta.estado = EstadoCuentaEnum.PAGADO;
      } else {
        cuenta.estado = EstadoCuentaEnum.PARCIAL;
      }

      const savedCuenta = await estadoCuentaRepo.save(cuenta);

      const historial = historialRepo.create({
        id_estado_cuenta: cuenta.id,
        tipo_movimiento: TipoMovimientoCuentaEnum.PAGO,
        monto_abono: montoAbono,
        saldo_anterior: saldoAnterior,
        saldo_nuevo: saldoNuevo,
        metodo_pago: dto.metodo_pago ?? null,
        numero_operacion: dto.numero_operacion ?? null,
        fecha_pago: dto.fecha_pago ? new Date(dto.fecha_pago) : new Date(),
        observacion: dto.observacion ?? null,
        comprobante_url: dto.comprobante_url ?? null,
        usuario_id: dto.usuario_id,
      });

      const savedHistorial = await historialRepo.save(historial);

      return {
        ok: true,
        message: saldoNuevo === 0 ? 'Cuenta pagada completamente' : 'Pago registrado',
        estadoCuenta: savedCuenta,
        movimiento: savedHistorial,
      };
    });
  }
}