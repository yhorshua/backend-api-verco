import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Warehouse } from '../../warehouses/entities/warehouse.entity';
import { Product } from '../../products/entities/product.entity';
import { ProductSize } from '../../products/entities/product-size.entity';
import { User } from '../../users/user.entity';

@Entity('StockMovements')
export class StockMovement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  warehouse_id: number;

  @ManyToOne(() => Warehouse, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: Warehouse;

  @Column()
  product_id: number;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ nullable: true })
  product_size_id: number;

  @ManyToOne(() => ProductSize, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'product_size_id' })
  productSize: ProductSize | null;

  @Column('decimal', { precision: 10, scale: 2 })
  quantity: number; // positivo: entrada, negativo: salida

  @Column({ length: 20 })
  unit_of_measure: string; // Ej: 'PAR', 'UND', 'KG'

  @Column({ length: 20 })
  movement_type: string; // 'entrada', 'salida', 'transferencia'

  @Column({ nullable: true })
  reference: string; // doc, pedido, motivo

  @Column({ type: 'datetime', default: () => 'GETDATE()' })
  created_at: Date;

  @Column({ nullable: true })
  user_id: number;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;
}