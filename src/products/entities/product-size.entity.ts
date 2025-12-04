import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Product } from './product.entity';
import { Stock } from './stock.entity';

@Entity('ProductSize')
export class ProductSize {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  product_id: number;

  @ManyToOne(() => Product, product => product.sizes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column()
  size: string;

  @Column()
  lot_pair: number; // pares por lote (si aplica a zapatillas)

  @OneToMany(() => Stock, stock => stock.productSize)
  stock: Stock[];
}