import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import { Warehouse } from './warehouse.entity';
import { Product } from './product.entity';
import { ProductSize } from './product-size.entity';
import { User } from './user.entity';

@Entity('StockMovements')
export class StockMovement {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  warehouse_id!: number;

  @ManyToOne(() => Warehouse, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse!: Warehouse;

  @Column({ type: 'int' })
  product_id!: number;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @Column({ type: 'int', nullable: true })
  product_size_id!: number | null;

  @ManyToOne(() => ProductSize, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'product_size_id' })
  productSize!: ProductSize | null;

  /**
   * Cantidad movida.
   * Entrada: positivo
   * Salida: negativo
   */
  @Column('decimal', { precision: 10, scale: 2 })
  quantity!: number;

  /**
   * Stock antes del movimiento.
   */
  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  previous_quantity!: number;

  /**
   * Stock después del movimiento.
   */
  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  new_quantity!: number;

  @Column({ type: 'varchar', length: 20 })
  unit_of_measure!: string;

  /**
   * Ejemplo:
   * entrada
   * salida
   * ajuste
   * transferencia
   * devolucion
   */
  @Column({ type: 'varchar', length: 20 })
  movement_type!: string;

  /**
   * ID interno del documento relacionado.
   * Ejemplo: id de guía, id de pedido, id de venta.
   */
  @Column({ type: 'int', nullable: true })
  reference_id!: number | null;

  /**
   * Tipo de documento relacionado.
   * Ejemplo: GUIA, PEDIDO, VENTA, AJUSTE
   */
  @Column({ type: 'varchar', length: 30, nullable: true })
  reference_type!: string | null;

  /**
   * Número visible del documento.
   * Ejemplo: GI-000123
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  reference!: string | null;

  /**
   * Detalle largo del movimiento.
   */
  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;

  /**
   * Usuario que registró el movimiento.
   */
  @Column({ type: 'int', nullable: true })
  user_id!: number | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user!: User | null;
}