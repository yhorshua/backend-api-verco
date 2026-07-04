import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import { Sale } from './sale.entity';
import { Product } from './product.entity';
import { ProductSize } from './product-size.entity';
import { StockMovement } from './stock-movements';

@Entity('SaleDetails')
export class SaleDetail {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  sale_id!: number;

  @Column({ type: 'int' })
  product_id!: number;

  @Column({ type: 'int', nullable: true })
  product_size_id!: number | null;

  @Column('decimal', {
    precision: 10,
    scale: 2,
  })
  quantity!: number;

  @Column('decimal', {
    precision: 10,
    scale: 2,
  })
  unit_price!: number;

  @Column({ type: 'int', nullable: true })
  stock_movement_id!: number | null;

  @Column('decimal', {
    name: 'factory_price_at_sale',
    precision: 10,
    scale: 2,
    default: 0,
  })
  factory_price_at_sale!: number;

  @ManyToOne(() => Sale)
  @JoinColumn({ name: 'sale_id' })
  sale!: Sale;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @ManyToOne(() => ProductSize, { nullable: true })
  @JoinColumn({ name: 'product_size_id' })
  productSize!: ProductSize;

  @ManyToOne(() => StockMovement, { nullable: true })
  @JoinColumn({ name: 'stock_movement_id' })
  stockMovement!: StockMovement;
}