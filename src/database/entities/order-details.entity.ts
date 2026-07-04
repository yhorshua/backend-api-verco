import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import { Order } from './orders.entity';
import { Product } from './product.entity';
import { ProductSize } from './product-size.entity';

@Entity('Order_Details')
export class OrderDetail {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  order_id: number;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column()
  product_id: number;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ type: 'int', nullable: true })
  product_size_id: number | null;

  @ManyToOne(() => ProductSize)
  @JoinColumn({ name: 'product_size_id' })
  productSize: ProductSize;

  @Column()
  size: string;

  @Column()
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unit_price: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    name: 'factory_price_at_order',
    default: 0,
  })
  factory_price_at_order: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total_amount: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    name: 'cost_total_at_order',
    default: 0,
  })
  cost_total_at_order: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    name: 'profit_amount_at_order',
    default: 0,
  })
  profit_amount_at_order: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  article_code_at_order: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  article_description_at_order: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  brand_name_at_order: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  model_code_at_order: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  color_at_order: string | null;
}