// escaneo.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Order } from './orders.entity';

@Entity('Escaneos')
export class Escaneo {
  @PrimaryGeneratedColumn({ name: 'id_escaner' })
  id: number;

  @Column({ name: 'id_pedido', type: 'int' })
  id_pedido: number;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'id_pedido' })
  order: Order;

  @Column({ name: 'codigo_producto', type: 'varchar', length: 50 })
  codigo_producto: string;

  @Column({ type: 'varchar', length: 10 })
  talla: string;

  @Column({ type: 'int' })
  cantidad: number;

  @Column({ name: 'fecha_escaner', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  fecha_escaner: Date;
}
