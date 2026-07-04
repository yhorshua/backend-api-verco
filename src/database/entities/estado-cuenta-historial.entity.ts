import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import { EstadoCuenta } from './estado-cuenta.entity';
import { User } from './user.entity';

export enum TipoMovimientoCuentaEnum {
  CREACION = 'CREACION',
  PAGO = 'PAGO',
  AJUSTE = 'AJUSTE',
  ANULACION = 'ANULACION',
}

@Entity('EstadoCuentaHistorial')
export class EstadoCuentaHistorial {
  @PrimaryGeneratedColumn({ name: 'id_historial' })
  id: number;

  @Column({ name: 'id_estado_cuenta', type: 'int' })
  id_estado_cuenta: number;

  @ManyToOne(() => EstadoCuenta)
  @JoinColumn({ name: 'id_estado_cuenta' })
  estadoCuenta: EstadoCuenta;

  @Column({
    name: 'tipo_movimiento',
    type: 'varchar',
    length: 30,
    default: TipoMovimientoCuentaEnum.PAGO,
  })
  tipo_movimiento: TipoMovimientoCuentaEnum;

  @Column('decimal', {
    name: 'monto_abono',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  monto_abono: number | null;

  @Column('decimal', {
    name: 'saldo_anterior',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  saldo_anterior: number | null;

  @Column('decimal', {
    name: 'saldo_nuevo',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  saldo_nuevo: number | null;

  @Column({
    name: 'metodo_pago',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  metodo_pago: string | null;

  @Column({
    name: 'numero_operacion',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  numero_operacion: string | null;

  @Column({
    name: 'fecha_pago',
    type: 'datetime',
    nullable: true,
  })
  fecha_pago: Date | null;

  @Column({
    name: 'observacion',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  observacion: string | null;

  @Column({
    name: 'comprobante_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  comprobante_url: string | null;

  @Column({
    name: 'fecha_registro',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fecha_registro: Date;

  @Column({ name: 'usuario_id', type: 'int' })
  usuario_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'usuario_id' })
  user: User;
}