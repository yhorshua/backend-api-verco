import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { Warehouse } from '../../warehouses/entities/warehouse.entity';
import { Product } from './product.entity';
import { ProductSize } from './product-size.entity';

@Entity('Stock')
@Unique(['warehouse_id', 'product_id', 'product_size_id'])
export class Stock {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  warehouse_id: number;

  @ManyToOne(() => Warehouse, warehouse => warehouse.stock, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: Warehouse;

  @Column()
  product_id: number;

  @ManyToOne(() => Product, product => product.stock, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ nullable: true })
  product_size_id: number;

  @ManyToOne(() => ProductSize, size => size.stock, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'product_size_id' })
  productSize: ProductSize | null;

  @Column('decimal', { precision: 10, scale: 2 })
  quantity: number;

  @Column()
  unit_of_measure: string; // Ej: 'UND', 'PAR', 'KG'
}