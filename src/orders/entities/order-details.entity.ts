// order-details.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Order } from './orders.entity';
import { Product } from '../../products/entities/product.entity';
import { ProductSize } from '../../products/entities/product-size.entity';

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

  @Column({ nullable: true })
  product_size_id: number;

  @ManyToOne(() => ProductSize)
  @JoinColumn({ name: 'product_size_id' })
  productSize: ProductSize;

  @Column()
  size: string;

  @Column()
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unit_price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total_amount: number;
}