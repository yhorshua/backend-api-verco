// abono.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { EstadoCuenta } from './estado-cuenta.entity';
import { Client } from './client.entity';

@Entity('Abonos')
export class Abono {
  @PrimaryGeneratedColumn({ name: 'id_abono' })
  id: number;

  @Column({ name: 'cliente_id', type: 'int' })
  cliente_id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'cliente_id' })
  cliente: Client;

  @Column('decimal', { name: 'monto_abono', precision: 10, scale: 2 })
  monto_abono: number;

  @Column({ name: 'fecha_abono', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  fecha_abono: Date;

  // efectivo | deposito | letra
  @Column({ name: 'tipo_abono', type: 'varchar', length: 50 })
  tipo_abono: string;

  // PEN | USD
  @Column({ name: 'moneda_abono', type: 'varchar', length: 10 })
  moneda_abono: string;

  @Column({ name: 'id_estado_cuenta', type: 'int' })
  id_estado_cuenta: number;

  @ManyToOne(() => EstadoCuenta)
  @JoinColumn({ name: 'id_estado_cuenta' })
  estadoCuenta: EstadoCuenta;
}
