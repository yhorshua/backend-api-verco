import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Product } from './product.entity';
import { Stock } from './stock.entity';

@Entity('ProductSize')
export class ProductSize {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Product, (product) => product.sizes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })  // TypeORM manejará la relación automáticamente
  product: Product;

  @Column()
  size: string;

  @Column()
  lot_pair: number;  // Pares por lote (si aplica)

  @OneToMany(() => Stock, (stock) => stock.productSize)
  stock: Stock[];
}
