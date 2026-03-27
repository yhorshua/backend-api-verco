// cuota.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { EstadoCuenta } from './estado-cuenta.entity';

@Entity('Cuota')
export class Cuota {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'estado_cuenta_id' })
    estado_cuenta_id: number;

    @ManyToOne(() => EstadoCuenta)
    @JoinColumn({ name: 'estado_cuenta_id' })
    estadoCuenta: EstadoCuenta;

    @Column()
    numero_cuota: number;

    @Column('decimal', { precision: 10, scale: 2 })
    monto: number;

    @Column('decimal', { precision: 10, scale: 2, default: 0 })
    monto_pagado: number;

    @Column('decimal', { precision: 10, scale: 2 })
    saldo: number;

    @Column({ type: 'date' })
    fecha_vencimiento: Date;

    @Column({ default: 'PENDIENTE' })
    estado: 'PENDIENTE' | 'PAGADO' | 'VENCIDO';

    @Column({ nullable: true, unique: true })
    numero_operacion?: string; // // número único del banco

    @Column({ type: 'datetime', nullable: true })
    fecha_pago: Date; // cuándo realmente pagó

    @Column({ nullable: true })
    observacion: string; // opcional (banco, referencia, etc)
}