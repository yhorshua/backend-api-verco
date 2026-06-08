import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import { Abono } from './abono.entity';
import { EstadoCuenta } from './estado-cuenta.entity';

@Entity('AbonoDetalle')
export class AbonoDetalle {

  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  id_abono!: number;

  @ManyToOne(() => Abono)
  @JoinColumn({ name: 'id_abono' })
  abono!: Abono;

  @Column()
  id_estado_cuenta!: number;

  @ManyToOne(() => EstadoCuenta)
  @JoinColumn({ name: 'id_estado_cuenta' })
  estadoCuenta!: EstadoCuenta;

  @Column('decimal', {
    precision: 10,
    scale: 2,
  })
  monto_aplicado!: number;
}