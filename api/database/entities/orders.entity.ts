import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany, // <- agregar
  JoinColumn,
} from 'typeorm';

import { Client } from './client.entity';
import { User } from './user.entity';
import { OrderStatus } from './order-status.entity';
import { OrderDetail } from './order-details.entity'; // <- agregar

@Entity('Orders')
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  proforma_number: number;

  // CLIENTE
  @Column()
  client_id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id' })
  client: Client;

  // VENDEDOR / USUARIO QUE REGISTRA EL PEDIDO
  @Column()
  user_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  // ESTADO DEL PEDIDO
  @Column()
  order_status_id: number;

  @ManyToOne(() => OrderStatus)
  @JoinColumn({ name: 'order_status_id' })
  status: OrderStatus;

  // FECHA DE REGISTRO
  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  request_date: Date;

  // APROBACIONES
  @Column({ nullable: true })
  approved_by: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'approved_by' })
  approvedByUser: User;

  @Column({ type: 'datetime', nullable: true })
  approval_date: Date;

  // OBSERVACIONES
  @Column({ length: 255, nullable: true })
  observations: string;

  @Column({ nullable: true, type: 'int' })
  id_guia_interna: number | null;

  @Column({ nullable: true, type: 'int' })
  id_factura: number | null;

  @Column({ nullable: true, type: 'int' })
  id_guia_remision: number | null;

  @Column({ type: 'int' })
  warehouse_id: number;

  // 🔹 RELACIÓN CON DETALLES
  @OneToMany(() => OrderDetail, (detail) => detail.order)
  details: OrderDetail[];
}
