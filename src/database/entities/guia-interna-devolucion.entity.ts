import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

import { GuiaInterna } from './guia-interna.entity';
import { GuiaInternaDevolucionDetalle } from './guia-interna-devolucion-detalle.entity';
import { Order } from './orders.entity';
import { Client } from './client.entity';
import { User } from './user.entity';
import { Warehouse } from './warehouse.entity';

export enum GuiaDevolucionEstadoEnum {
  REGISTRADA = 'REGISTRADA',
  ANULADA = 'ANULADA',
}

@Entity('GuiaInternaDevolucion')
@Index('idx_dev_guia', ['id_guia_interna'])
@Index('idx_dev_pedido', ['id_pedido'])
@Index('idx_dev_cliente', ['cliente_id'])
@Index('idx_dev_fecha', ['created_at'])
export class GuiaInternaDevolucion {
  @PrimaryGeneratedColumn({ name: 'id_devolucion' })
  id: number;

  @Column({ name: 'id_guia_interna', type: 'int' })
  id_guia_interna: number;

  @ManyToOne(() => GuiaInterna)
  @JoinColumn({ name: 'id_guia_interna' })
  guiaInterna: GuiaInterna;

  @Column({ name: 'id_pedido', type: 'int' })
  id_pedido: number;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'id_pedido' })
  order: Order;

  @Column({ name: 'cliente_id', type: 'int' })
  cliente_id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'cliente_id' })
  cliente: Client;

  @Column({ name: 'usuario_id', type: 'int' })
  usuario_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'usuario_id' })
  usuario: User;

  @Column({ name: 'warehouse_id', type: 'int' })
  warehouse_id: number;

  @ManyToOne(() => Warehouse)
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: Warehouse;

  @Column({
    name: 'motivo_general',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  motivo_general: string | null;

  @Column({
    name: 'observacion',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  observacion: string | null;

  @Column({
    name: 'total_unidades',
    type: 'int',
    default: 0,
  })
  total_unidades: number;

  @Column('decimal', {
    name: 'total_importe',
    precision: 10,
    scale: 2,
    default: 0,
  })
  total_importe: number;

  @Column('decimal', {
    name: 'total_costo',
    precision: 10,
    scale: 2,
    default: 0,
  })
  total_costo: number;

  @Column('decimal', {
    name: 'total_utilidad_revertida',
    precision: 10,
    scale: 2,
    default: 0,
  })
  total_utilidad_revertida: number;

  @Column({
    name: 'estado',
    type: 'varchar',
    length: 30,
    default: GuiaDevolucionEstadoEnum.REGISTRADA,
  })
  estado: GuiaDevolucionEstadoEnum;

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
  })
  created_at: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'datetime',
  })
  updated_at: Date;

  @OneToMany(
    () => GuiaInternaDevolucionDetalle,
    (detalle) => detalle.devolucion,
  )
  detalles: GuiaInternaDevolucionDetalle[];
}