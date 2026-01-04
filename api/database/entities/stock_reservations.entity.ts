import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

import { Order } from './orders.entity';
import { Product } from './product.entity';
import { Warehouse } from './warehouse.entity';
import { ProductSize } from './product-size.entity';
import { StockReservationStatus } from './stock-reservation-status.enum';

@Entity('stock_reservations')
@Index('idx_sr_active', ['warehouse_id', 'product_id', 'product_size_id', 'status'])
@Index('idx_sr_order', ['order_id'])
export class StockReservation {
  @PrimaryGeneratedColumn()
  id: number;

  /* ===================== FK IDs ===================== */

  @Column()
  order_id: number;

  @Column()
  warehouse_id: number;

  @Column()
  product_id: number;

  @Column({ nullable: true })
  product_size_id: number | null;

  /* ===================== RELACIONES ===================== */

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @ManyToOne(() => Warehouse)
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: Warehouse;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @ManyToOne(() => ProductSize, { nullable: true })
  @JoinColumn({ name: 'product_size_id' })
  productSize?: ProductSize | null;

  /* ===================== DATOS ===================== */

  @Column('decimal', { precision: 10, scale: 2 })
  quantity: number;

  @Column({
    type: 'enum',
    enum: StockReservationStatus,
    default: StockReservationStatus.RESERVADO,
  })
  status: StockReservationStatus;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime', nullable: true })
  updated_at: Date | null;
}
