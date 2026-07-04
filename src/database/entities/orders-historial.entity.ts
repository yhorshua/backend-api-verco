import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

import { Order } from './orders.entity';
import { User } from './user.entity';

@Entity('OrdersHistorial')
@Index('idx_orders_historial_pedido', ['id_pedido'])
@Index('idx_orders_historial_usuario', ['usuario_id'])
@Index('idx_orders_historial_fecha', ['fecha_cambio'])
export class OrdersHistorial {
  @PrimaryGeneratedColumn()
  id_historial: number;

  @Column({ type: 'int' })
  id_pedido: number;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_pedido' })
  order: Order;

  @Column({ type: 'varchar', length: 50, nullable: true })
  estado_anterior: string | null;

  @Column({ type: 'varchar', length: 50 })
  estado_nuevo: string;

  @CreateDateColumn({
    type: 'datetime',
    name: 'fecha_cambio',
  })
  fecha_cambio: Date;

  @Column({ type: 'int' })
  usuario_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'usuario_id' })
  user: User;

  @Column({ type: 'varchar', length: 255, nullable: true })
  observacion: string | null;
}