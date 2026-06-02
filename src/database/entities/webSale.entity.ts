import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany
} from 'typeorm';

import { User } from './user.entity';
import { WebSaleDetail } from './webDetail.entity';

export enum WebSaleStatus {
  PENDING = 'PENDIENTE',
  APPROVED = 'APROBADO',
  DISPATCHED = 'DESPACHADO',
  DELIVERED = 'ENTREGADO',
  CANCELED = 'CANCELADO'
}

@Entity('WebSales')
export class WebSale {

  @PrimaryGeneratedColumn()
  id!: number;

  // Cliente
  @Column()
  customer_name!: string;

  @Column()
  customer_dni!: string;

  @Column()
  customer_phone!: string;

  @Column()
  customer_address!: string;

  @Column()
  department!: string;

  @Column()
  province!: string;

  @Column()
  district!: string;

  @Column({ nullable: true })
  reference!: string;

  // Pago
  @Column()
  payment_method!: string;

  @Column('decimal', { precision: 10, scale: 2 })
  total_amount!: number;

  // Observaciones
  @Column({ nullable: true, type: 'text' })
  observations!: string;

  // Estado del pedido
  @Column({
    type: 'varchar',
    default: WebSaleStatus.PENDING
  })
  status!: WebSaleStatus;

  // Usuario vendedor
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column()
  user_id!: number;

  // Fecha registro
  @Column({
    type: 'datetime',
    default: () => 'GETDATE()'
  })
  created_at!: Date;

  // Detalles
  @OneToMany(() => WebSaleDetail, detail => detail.sale, {
    cascade: true
  })
  details!: WebSaleDetail[];
}