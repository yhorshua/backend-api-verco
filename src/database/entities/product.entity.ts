import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { ProductSize } from './product-size.entity';
import { Series } from './series.entity';
import { Stock } from './stock.entity';
import { Category } from './categories.entity';
import { ProductImage } from './productImage.entity';

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

  @Column('decimal', { precision: 10, scale: 2 })
  factory_price: number;

  @Column('decimal', { precision: 10, scale: 2 })
  dropshipping_price: number;

  @Column('decimal', { precision: 10, scale: 2 })
  wholesale_price: number;

  @Column({ type: 'varchar', length: 150, nullable: true })
  slug?: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  ecommerce_name?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  short_description?: string;

  @Column({ type: 'text', nullable: true })
  full_description?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  gender?: string;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  selling_price?: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  original_price?: number;

  @Column({ type: 'int', default: 0 })
  discount_percent: number;

  @Column({ type: 'bit', default: () => "b'0'" })
  is_new: boolean;

  @Column({ type: 'bit', default: () => "b'0'" })
  is_featured: boolean;

  @Column({ type: 'bit', default: () => "b'0'" })
  is_published: boolean;

  @Column({ type: 'varchar', length: 150, nullable: true })
  seo_title?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  seo_description?: string;

  @OneToMany(() => ProductImage, (image) => image.product)
  images: ProductImage[];
}
