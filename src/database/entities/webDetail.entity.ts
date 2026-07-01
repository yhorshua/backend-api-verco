import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn
} from 'typeorm';

import { WebSale } from './webSale.entity';
import { Product } from './product.entity';
import { ProductSize } from './product-size.entity';

export enum DetailStatus {
  PENDIENTE = 'PENDIENTE',
  VENDIDO = 'VENDIDO',
  DEVUELTO = 'DEVUELTO'
}

@Entity('WebSaleDetails')
export class WebSaleDetail {

  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => WebSale, sale => sale.details, {
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'sale_id' })
  sale!: WebSale;

  @Column()
  sale_id!: number;

  // Producto
  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @Column()
  product_id!: number;

  // Talla
  @ManyToOne(() => ProductSize)
  @JoinColumn({ name: 'product_size_id' })
  productSize!: ProductSize;

  @Column()
  product_size_id!: number;

  @Column()
  size!: string;

  // Cantidad
  @Column()
  quantity!: number;

  // Precio vendido
  @Column('decimal', {
    precision: 10,
    scale: 2
  })
  sale_price!: number;

  // Subtotal
  @Column('decimal', {
    precision: 10,
    scale: 2
  })
  subtotal!: number;

    @Column('decimal', {
    precision: 10,
    scale: 2,
    default: 0
  })
  purchase_price_at_sale!: number;

  @Column({
    type: 'varchar',
    default: DetailStatus.PENDIENTE
  })
  detail_status!: DetailStatus;

  @Column({
    nullable: true
  })
  returned_at!: Date;

  @Column({
    nullable: true
  })
  sold_at!: Date;

  @Column('decimal', {
    precision: 10,
    scale: 2,
    nullable: true
  })
  final_amount!: number;
}