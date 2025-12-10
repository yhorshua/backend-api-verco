import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Client } from './client.entity';
import { User } from './user.entity';
import { Warehouse } from './warehouse.entity';
import { OrderStatus } from './order-status.entity';

@Entity('Orders')
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  proforma_number: number;

  @Column()
  client_id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column()
  user_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  seller: User;

  @Column()
  warehouse_id: number;

  @ManyToOne(() => Warehouse)
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: Warehouse;

  @Column()
  order_status_id: number;

  @ManyToOne(() => OrderStatus)
  @JoinColumn({ name: 'order_status_id' })
  status: OrderStatus;

  @Column({ type: 'datetime', nullable: true })
  request_date: Date;

  @Column({ nullable: true })
  approved_by: number;

  @Column({ type: 'datetime', nullable: true })
  approval_date: Date;

  @Column({ length: 255, nullable: true })
  observations: string;

  @Column({ nullable: true })
  id_guia_interna: number;

  @Column({ nullable: true })
  id_factura: number;

  @Column({ nullable: true })
  id_guia_remision: number;
}