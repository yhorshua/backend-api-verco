// estado-cuenta-historial.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { EstadoCuenta } from './estado-cuenta.entity';
import { User } from './user.entity';

@Entity('EstadoCuentaHistorial')
export class EstadoCuentaHistorial {
  @PrimaryGeneratedColumn({ name: 'id_historial' })
  id: number;

  @Column({ name: 'id_estado_cuenta', type: 'int' })
  id_estado_cuenta: number;

  @ManyToOne(() => EstadoCuenta)
  @JoinColumn({ name: 'id_estado_cuenta' })
  estadoCuenta: EstadoCuenta;

  @Column('decimal', { name: 'monto_abono', precision: 10, scale: 2, nullable: true })
  monto_abono: number | null;

  @Column('decimal', { name: 'saldo_anterior', precision: 10, scale: 2, nullable: true })
  saldo_anterior: number | null;

  @Column('decimal', { name: 'saldo_nuevo', precision: 10, scale: 2, nullable: true })
  saldo_nuevo: number | null;

  @Column({ name: 'fecha_registro', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  fecha_registro: Date;

  @Column({ name: 'usuario_id', type: 'int' })
  usuario_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'usuario_id' })
  user: User;
}
