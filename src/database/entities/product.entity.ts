import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { ProductSize } from './product-size.entity';
import { Series } from './series.entity';
import { Stock } from './stock.entity';
import { Category } from './categories.entity';

@Entity('Products')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  article_code: string;

  @Column()
  article_description: string;

  @Column()
  article_series: string;

  @Column()
  type_origin: string;

  @Column('decimal', { precision: 10, scale: 2 })
  manufacturing_cost: number;

  @Column('decimal', { precision: 10, scale: 2 })
  unit_price: number;

  @Column({ nullable: true })
  brand_name: string;

  @Column({ nullable: true })
  model_code: string;


  @ManyToOne(() => Category, (category) => category.products)
  @JoinColumn({ name: 'category_id' }) // Especifica explícitamente el nombre de la columna de la clave foránea
  category: Category;

  @Column({ nullable: true })
  material_type: string;

  @Column({ nullable: true })
  color: string;

  @Column({ nullable: true })
  stock_minimum: number;

  @Column({ nullable: true })
  product_image: string;

  @Column({ type: 'bit', default: true })
  status: boolean;

  @Column({ type: 'datetime', default: () => 'GETDATE()' })
  created_at: Date;

  @OneToMany(() => ProductSize, (size) => size.product)
  sizes: ProductSize[];

  @ManyToOne(() => Series)
  @JoinColumn({ name: 'article_series', referencedColumnName: 'code' })
  series: Series;

  @OneToMany(() => Stock, (stock) => stock.product)
  stock: Stock[];
}
