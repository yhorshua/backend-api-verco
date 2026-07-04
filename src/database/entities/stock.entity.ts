import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';

import { Warehouse } from './warehouse.entity';
import { Product } from './product.entity';
import { ProductSize } from './product-size.entity';

@Entity('Stock')
@Unique('uq_stock_warehouse_product_size', [
  'warehouse_id',
  'product_id',
  'product_size_id',
])
export class Stock {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  warehouse_id: number;

  @ManyToOne(() => Warehouse, (warehouse) => warehouse.stock, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: Warehouse;

  @Column({ type: 'int' })
  product_id: number;

  @ManyToOne(() => Product, (product) => product.stock, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({
    type: 'int',
    nullable: true,
  })
  product_size_id: number | null;

  @ManyToOne(() => ProductSize, (size) => size.stock, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'product_size_id' })
  productSize: ProductSize | null;

  @Column('decimal', {
    precision: 10,
    scale: 2,
  })
  quantity: number;

  @Column({
    type: 'varchar',
    length: 20,
  })
  unit_of_measure: string;
}