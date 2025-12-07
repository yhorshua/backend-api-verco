import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Sale } from './sale.entity';
import { Product } from '../entities/product.entity';
import { ProductSize } from '../entities/product-size.entity';

@Entity('SaleDetails')
export class SaleDetail {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  sale_id: number;

  @ManyToOne(() => Sale, sale => sale.details)
  @JoinColumn({ name: 'sale_id' })
  sale: Sale;

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

  @Column('decimal', { precision: 10, scale: 2 })
  quantity: number;

  @Column('decimal', { precision: 10, scale: 2 })
  unit_price: number;
}