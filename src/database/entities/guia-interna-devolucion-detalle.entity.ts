import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

import { GuiaInternaDevolucion } from './guia-interna-devolucion.entity';
import { GuiaInternaDetalle } from './guia-interna-detalle.entity';
import { Product } from './product.entity';
import { ProductSize } from './product-size.entity';

export enum GuiaDevolucionDestinoEnum {
  STOCK_DISPONIBLE = 'STOCK_DISPONIBLE',
  CUARENTENA = 'CUARENTENA',
  MERMA = 'MERMA',
}

@Entity('GuiaInternaDevolucionDetalle')
@Index('idx_dev_det_devolucion', ['id_devolucion'])
@Index('idx_dev_det_guia_detalle', ['id_guia_interna_detalle'])
@Index('idx_dev_det_producto_size', ['producto_id', 'product_size_id'])
export class GuiaInternaDevolucionDetalle {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'id_devolucion', type: 'int' })
  id_devolucion: number;

  @ManyToOne(
    () => GuiaInternaDevolucion,
    (devolucion) => devolucion.detalles,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'id_devolucion' })
  devolucion: GuiaInternaDevolucion;

  @Column({ name: 'id_guia_interna_detalle', type: 'int' })
  id_guia_interna_detalle: number;

  @ManyToOne(() => GuiaInternaDetalle)
  @JoinColumn({ name: 'id_guia_interna_detalle' })
  guiaInternaDetalle: GuiaInternaDetalle;

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

  @Column({
    name: 'talla',
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  talla: string | null;

  @Column({ name: 'cantidad', type: 'int' })
  cantidad: number;

  @Column('decimal', {
    name: 'precio_unitario',
    precision: 10,
    scale: 2,
  })
  precio_unitario: number;

  @Column('decimal', {
    name: 'factory_price_at_return',
    precision: 10,
    scale: 2,
    default: 0,
  })
  factory_price_at_return: number;

  @Column('decimal', {
    name: 'total_importe',
    precision: 10,
    scale: 2,
  })
  total_importe: number;

  @Column('decimal', {
    name: 'costo_total',
    precision: 10,
    scale: 2,
    default: 0,
  })
  costo_total: number;

  @Column('decimal', {
    name: 'utilidad_revertida',
    precision: 10,
    scale: 2,
    default: 0,
  })
  utilidad_revertida: number;

  @Column({
    name: 'motivo',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  motivo: string | null;

  @Column({
    name: 'destino',
    type: 'varchar',
    length: 30,
    default: GuiaDevolucionDestinoEnum.STOCK_DISPONIBLE,
  })
  destino: GuiaDevolucionDestinoEnum;

  @Column({
    name: 'reingresa_stock',
    type: 'tinyint',
    width: 1,
    default: 1,
  })
  reingresa_stock: boolean;

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
  })
  created_at: Date;
}