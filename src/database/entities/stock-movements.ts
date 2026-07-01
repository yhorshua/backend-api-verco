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

  @Column()
  warehouse_id!: number;

  @ManyToOne(() => Warehouse, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse!: Warehouse;

  @Column()
  product_id!: number;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @Column({ nullable: true, type: 'int' })
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

  @Column({ length: 20 })
  unit_of_measure!: string;

  /**
   * Ejemplo:
   * entrada
   * salida
   * ajuste
   * transferencia
   * devolucion
   */
  @Column({ length: 20 })
  movement_type!: string;

  /**
   * ID interno del documento relacionado.
   * Ejemplo: id de guía, id de pedido, id de venta.
   */
  @Column({ nullable: true, type: 'int' })
  reference_id!: number | null;

  /**
   * Tipo de documento relacionado.
   * Ejemplo: GUIA, PEDIDO, VENTA, AJUSTE
   */
  @Column({ nullable: true, length: 30 })
  reference_type!: string | null;

  /**
   * Número visible del documento.
   * Ejemplo: GUIA-000123
   */
  @Column({ nullable: true, length: 100 })
  reference!: string | null;

  /**
   * Detalle largo del movimiento.
   */
  @Column({ nullable: true, type: 'text' })
  notes!: string | null;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;

  /**
   * Usuario que registró el movimiento.
   */
  @Column({ nullable: true })
  user_id!: number;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user!: User | null;
}