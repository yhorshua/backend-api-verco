// estado-cuenta.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Client } from './client.entity';
import { User } from './user.entity';
import { GuiaInterna } from './guia-interna.entity';

@Entity('EstadoCuenta')
export class EstadoCuenta {
  @PrimaryGeneratedColumn({ name: 'id_estado_cuenta' })
  id: number;

  @Column({ name: 'cliente_id', type: 'int' })
  cliente_id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'cliente_id' })
  cliente: Client;

  @Column({ name: 'vendedor_id', type: 'int' })
  vendedor_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'vendedor_id' })
  vendedor: User;

  @Column('decimal', { name: 'monto_inicial', precision: 10, scale: 2 })
  monto_inicial: number;

  @Column('decimal', { name: 'monto_pago', precision: 10, scale: 2, nullable: true, default: 0 })
  monto_pago: number | null;

  @Column('decimal', { name: 'monto_saldo', precision: 10, scale: 2 })
  monto_saldo: number;

  @Column({ name: 'fecha_registro', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  fecha_registro: Date;

  @Column({ name: 'id_guia_interna', type: 'int' })
  id_guia_interna: number;

  @ManyToOne(() => GuiaInterna)
  @JoinColumn({ name: 'id_guia_interna' })
  guia_interna: GuiaInterna;
}
