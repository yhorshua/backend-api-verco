// orders-historial.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Order } from './orders.entity';
import { User } from '../../users/user.entity';

@Entity('OrdersHistorial')
export class OrdersHistorial {
  @PrimaryGeneratedColumn()
  id_historial: number;

  @Column()
  id_pedido: number;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'id_pedido' })
  order: Order;

  @Column({ nullable: true })
  estado_anterior: string;

  @Column()
  estado_nuevo: string;

  @Column({ type: 'datetime', default: () => 'GETDATE()' })
  fecha_cambio: Date;

  @Column()
  usuario_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'usuario_id' })
  user: User;
}