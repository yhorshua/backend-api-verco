import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';

import { EstadoCuenta, EstadoCuentaEnum } from '../database/entities/estado-cuenta.entity';
import { Abono } from '../database/entities/abono.entity';
import { Client } from '../database/entities/client.entity';

import { RegistrarAbonoDto } from './dto/registrarAbonoDto';
import { AbonoDetalle } from 'src/database/entities/abonoDetalle.entity';
import { EstadoCuentaHistorial } from 'src/database/entities/estado-cuenta-historial.entity';
import { SaldoFavorCliente } from 'src/database/entities/saldoFavorCliente';
import { Cuota } from 'src/database/entities/cuota.entity';

@Injectable()
export class EstadoCuentaService {
    constructor(
        private readonly dataSource: DataSource,

        @InjectRepository(Client)
        private readonly clientRepo: Repository<Client>,

        @InjectRepository(EstadoCuenta)
        private readonly estadoCuentaRepo: Repository<EstadoCuenta>,

        @InjectRepository(Abono)
        private readonly abonoRepo: Repository<Abono>,

        @InjectRepository(AbonoDetalle)
        private readonly abonoDetalleRepo: Repository<AbonoDetalle>,

        @InjectRepository(EstadoCuentaHistorial)
        private readonly historialRepo: Repository<EstadoCuentaHistorial>,

        @InjectRepository(SaldoFavorCliente)
        private readonly saldoFavorRepo: Repository<SaldoFavorCliente>,

        @InjectRepository(Cuota)
        private readonly cuotaRepo: Repository<Cuota>,
    ) { }


    async getEstadoCuentaCliente(
        clienteId: number,
    ) {
        const cliente =
            await this.clientRepo.findOne({
                where: {
                    id: clienteId,
                },
            });

        if (!cliente) {
            throw new NotFoundException(
                'Cliente no encontrado',
            );
        }

        const cuentas =
            await this.estadoCuentaRepo.find({
                where: {
                    cliente_id: clienteId,
                },
                relations: [
                    'guia_interna',
                ],
                order: {
                    fecha_registro: 'DESC',
                },
            });

        const historialAbonos =
            await this.abonoDetalleRepo.find({
                where: {
                    estadoCuenta: {
                        cliente_id: clienteId,
                    },
                },
                relations: [
                    'abono',
                    'estadoCuenta',
                ],
                order: {
                    abono: {
                        fecha_abono: 'DESC',
                    },
                },
            });

        const historialMovimientos =
            await this.historialRepo.find({
                where: {
                    estadoCuenta: {
                        cliente_id: clienteId,
                    },
                },
                relations: [
                    'estadoCuenta',
                ],
                order: {
                    fecha_registro: 'DESC',
                },
            });

        const cuotas =
            await this.cuotaRepo.find({
                where: {
                    estadoCuenta: {
                        cliente_id: clienteId,
                    },
                },
                relations: [
                    'estadoCuenta',
                ],
                order: {
                    fecha_vencimiento: 'ASC',
                },
            });

        const saldoFavor =
            await this.saldoFavorRepo.find({
                where: {
                    cliente_id: clienteId,
                },
                order: {
                    fecha_registro: 'DESC',
                },
            });

        const deudaTotal =
            cuentas.reduce(
                (acc, x) =>
                    acc + Number(x.monto_inicial),
                0,
            );

        const totalPagado =
            cuentas.reduce(
                (acc, x) =>
                    acc + Number(x.monto_pago || 0),
                0,
            );

        const saldoPendiente =
            cuentas.reduce(
                (acc, x) =>
                    acc + Number(x.monto_saldo),
                0,
            );

        const saldoFavorTotal =
            saldoFavor.reduce(
                (acc, x) =>
                    acc + Number(x.saldo),
                0,
            );

        const cuentasPendientes =
            cuentas.filter(
                (x) => x.estado !== 'PAGADO',
            ).length;

        const cuentasPagadas =
            cuentas.filter(
                (x) => x.estado === 'PAGADO',
            ).length;

        const creditosVencidos =
            cuentas.filter(
                (x) =>
                    x.fecha_vencimiento &&
                    new Date(x.fecha_vencimiento) < new Date() &&
                    x.estado !== 'PAGADO',
            ).length;

        return {
            cliente,

            resumen: {
                deudaTotal,
                totalPagado,
                saldoPendiente,
                saldoFavor: saldoFavorTotal,
                cuentasPendientes,
                cuentasPagadas,
                creditosVencidos,
            },

            cuentas,

            historialAbonos,

            historialMovimientos,

            cuotas,

            saldoFavor,
        };
    }

    async registrarAbono(
        dto: RegistrarAbonoDto,
        userId: number,
    ) {
        if (dto.monto_abono <= 0) {
            throw new BadRequestException(
                'El monto del abono debe ser mayor a cero',
            );
        }

        return this.dataSource.transaction(
            async (manager) => {

                const cliente = await manager
                    .getRepository(Client)
                    .findOne({
                        where: {
                            id: dto.cliente_id,
                        },
                    });

                if (!cliente) {
                    throw new NotFoundException(
                        'Cliente no encontrado',
                    );
                }

                let montoDisponible =
                    Number(dto.monto_abono);

                const cuentas = await manager
                    .getRepository(EstadoCuenta)
                    .find({
                        where: {
                            cliente_id: dto.cliente_id,
                            estado: In([
                                EstadoCuentaEnum.PENDIENTE,
                                EstadoCuentaEnum.PARCIAL,
                            ]),
                        },
                        order: {
                            fecha_registro: 'ASC',
                        },
                    });

                if (!cuentas.length) {
                    throw new BadRequestException(
                        'El cliente no tiene deuda pendiente',
                    );
                }

                const abono = await manager
                    .getRepository(Abono)
                    .save({
                        cliente_id: dto.cliente_id,
                        monto_abono: dto.monto_abono,
                        tipo_abono: dto.tipo_abono,
                        moneda_abono: dto.moneda_abono,

                        usuario_registro_id: userId,
                    });

                const detallesAbono: AbonoDetalle[] = [];

                for (const cuenta of cuentas) {

                    if (montoDisponible <= 0) {
                        break;
                    }

                    const saldoAnterior =
                        Number(cuenta.monto_saldo);

                    let montoAplicado = 0;

                    if (montoDisponible >= saldoAnterior) {

                        montoAplicado = saldoAnterior;

                        cuenta.monto_pago =
                            Number(cuenta.monto_pago || 0)
                            + saldoAnterior;

                        cuenta.monto_saldo = 0;

                        cuenta.estado =
                            EstadoCuentaEnum.PAGADO;

                        montoDisponible -= saldoAnterior;

                    } else {

                        montoAplicado = montoDisponible;

                        cuenta.monto_pago =
                            Number(cuenta.monto_pago || 0)
                            + montoDisponible;

                        cuenta.monto_saldo =
                            saldoAnterior - montoDisponible;

                        cuenta.estado =
                            EstadoCuentaEnum.PARCIAL;

                        montoDisponible = 0;
                    }

                    await manager
                        .getRepository(EstadoCuenta)
                        .save(cuenta);

                    await manager
                        .getRepository(EstadoCuentaHistorial)
                        .save({
                            id_estado_cuenta: cuenta.id,
                            monto_abono: montoAplicado,
                            saldo_anterior: saldoAnterior,
                            saldo_nuevo: cuenta.monto_saldo,
                            usuario_id: userId,
                        });

                    detallesAbono.push(
                        manager
                            .getRepository(AbonoDetalle)
                            .create({
                                id_abono: abono.id,
                                id_estado_cuenta: cuenta.id,
                                monto_aplicado: montoAplicado,
                            }),
                    );
                }

                if (detallesAbono.length > 0) {
                    await manager
                        .getRepository(AbonoDetalle)
                        .save(detallesAbono);
                }

                /*
                 * Si sobra dinero luego de cancelar todas las deudas,
                 * registrar saldo a favor.
                 */
                if (montoDisponible > 0) {

                    const saldoFavorExistente =
                        await manager
                            .getRepository(SaldoFavorCliente)
                            .findOne({
                                where: {
                                    cliente_id: dto.cliente_id,
                                },
                            });

                    if (saldoFavorExistente) {

                        saldoFavorExistente.saldo =
                            Number(saldoFavorExistente.saldo)
                            + montoDisponible;

                        await manager
                            .getRepository(SaldoFavorCliente)
                            .save(saldoFavorExistente);

                    } else {

                        await manager
                            .getRepository(SaldoFavorCliente)
                            .save({
                                cliente_id: dto.cliente_id,
                                saldo: montoDisponible,
                                usuario_registro_id: userId,
                            });
                    }
                }

                return {
                    ok: true,
                    abonoId: abono.id,
                    clienteId: dto.cliente_id,
                    montoAbono: dto.monto_abono,
                    montoAplicado:
                        dto.monto_abono - montoDisponible,
                    montoSobrante: montoDisponible,
                    detallesAplicados:
                        detallesAbono.length,
                };
            },
        );
    }
}