import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Sale } from './sale.entity';
import { Product } from './product.entity';
import { ProductSize } from './product-size.entity';
import { StockMovement } from './stock-movements';

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

  @Column({ nullable: true, type: 'int' })
  product_size_id: number | null;

  @ManyToOne(() => ProductSize, { nullable: true })
  @JoinColumn({ name: 'product_size_id' })
  productSize: ProductSize | null;

  @Column('decimal', { precision: 10, scale: 2 })
  quantity: number;

  @Column('decimal', { precision: 10, scale: 2 })
  unit_price: number;

  // Relación con StockMovement
  @ManyToOne(() => StockMovement, { nullable: true })
  @JoinColumn({ name: 'stock_movement_id' })
  stockMovement: StockMovement | null;
}