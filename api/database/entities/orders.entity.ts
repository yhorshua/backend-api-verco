import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import { Client } from './client.entity';
import { User } from './user.entity';
import { OrderStatus } from './order-status.entity';

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
}
