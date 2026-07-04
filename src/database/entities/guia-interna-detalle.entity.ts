import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import { GuiaInterna } from './guia-interna.entity';
import { Product } from './product.entity';
import { ProductSize } from './product-size.entity';
import { OrderDetail } from './order-details.entity';

@Entity('GuiaInternaDetalle')
export class GuiaInternaDetalle {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'id_guia_interna', type: 'int' })
  id_guia_interna: number;

  @ManyToOne(() => GuiaInterna, (g) => g.detalles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_guia_interna' })
  guia: GuiaInterna;

  @Column({ name: 'order_detail_id', type: 'int', nullable: true })
  order_detail_id: number | null;

  @ManyToOne(() => OrderDetail, { nullable: true })
  @JoinColumn({ name: 'order_detail_id' })
  orderDetail: OrderDetail | null;

  @Column({ name: 'producto_id', type: 'int' })
  producto_id: number;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'producto_id' })
  product: Product;

  @Column({ name: 'product_size_id', type: 'int', nullable: true })
  product_size_id: number | null;

  @ManyToOne(() => ProductSize, { nullable: true })
  @JoinColumn({ name: 'product_size_id' })
  productSize: ProductSize | null;

  @Column({ name: 'talla', type: 'varchar', length: 10, nullable: true })
  talla: string | null;

  @Column({ name: 'producto_codigo', type: 'varchar', length: 50 })
  producto_codigo: string;

  @Column({ name: 'producto_descripcion', type: 'varchar', length: 150 })
  producto_descripcion: string;

  @Column({ name: 'producto_cantidad', type: 'int' })
  producto_cantidad: number;

  @Column('decimal', {
    name: 'producto_precio_unitario',
    precision: 10,
    scale: 2,
  })
  producto_precio_unitario: number;

  @Column('decimal', {
    name: 'factory_price_at_guide',
    precision: 10,
    scale: 2,
    default: 0,
  })
  factory_price_at_guide: number;

  @Column('decimal', {
    name: 'producto_total',
    precision: 10,
    scale: 2,
  })
  producto_total: number;

  @Column('decimal', {
    name: 'costo_total',
    precision: 10,
    scale: 2,
    default: 0,
  })
  costo_total: number;

  @Column('decimal', {
    name: 'utilidad_total',
    precision: 10,
    scale: 2,
    default: 0,
  })
  utilidad_total: number;
}