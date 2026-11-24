import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EcommerceOrder } from './ecommerce-order.entity';
import { ProductSize } from './product-size.entity';
import { Product } from './product.entity';

@Entity('EcommerceOrderDetails')
export class EcommerceOrderDetail {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  order_id!: number;

  @ManyToOne(() => EcommerceOrder, (order) => order.details, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'order_id' })
  order!: EcommerceOrder;

  @Column({ type: 'int' })
  product_id!: number;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @Column({ type: 'int' })
  product_size_id!: number;

  @ManyToOne(() => ProductSize, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_size_id' })
  product_size!: ProductSize;

  @Column({ type: 'int', unsigned: true })
  quantity!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  unit_price!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  subtotal!: string;

  @Column({ type: 'varchar', length: 80 })
  article_code_snapshot!: string;

  @Column({ type: 'varchar', length: 255 })
  product_name_snapshot!: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  color_snapshot?: string | null;

  @Column({ type: 'varchar', length: 30 })
  size_snapshot!: string;
  @Column({type:'varchar',length:500,nullable:true}) image_url_snapshot!:string|null;
}
