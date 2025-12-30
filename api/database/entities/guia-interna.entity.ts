// guia-interna.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Order } from './orders.entity';
import { User } from './user.entity';
import { Client } from './client.entity';
import { GuiaInternaDetalle } from './guia-interna-detalle.entity';

@Entity('GuiaInterna')
export class GuiaInterna {
  @PrimaryGeneratedColumn({ name: 'id_guia_interna' })
  id: number;

  @Column({ name: 'id_pedido', type: 'int' })
  id_pedido: number;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'id_pedido' })
  order: Order;

  @Column({ name: 'fecha_registro', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  fecha_registro: Date;

  @Column({ name: 'cliente_id', type: 'int' })
  cliente_id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'cliente_id' })
  client: Client;

  @Column({ name: 'usuario_id', type: 'int' })
  usuario_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'usuario_id' })
  user: User;

  @Column({ type: 'varchar', length: 50, nullable: true, default: 'Pendiente' })
  estado: string;

  @Column({ type: 'int' })
  proforma_number: number;

  @Column({ type: 'int', nullable: true })
  total_unidades: number | null;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  total_precio: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  observaciones: string;

  @OneToMany(() => GuiaInternaDetalle, (d) => d.guia)
  detalles: GuiaInternaDetalle[];
}
