// inventory-movements.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Product } from '../entities/product.entity';
import { ProductSize } from '../entities/product-size.entity';
import { Warehouse } from './warehouse.entity';
import { User } from './user.entity';

@Entity('InventoryMovements')
export class InventoryMovement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  product_id: number;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ nullable: true })
  product_size_id: number;

  @ManyToOne(() => ProductSize)
  @JoinColumn({ name: 'product_size_id' })
  productSize: ProductSize;

  @Column()
  warehouse_id: number;

  @ManyToOne(() => Warehouse)
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: Warehouse;

  @Column()
  movement_type: string;

  @Column({ nullable: true })
  reference_id: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity: number;

  @Column()
  unit_of_measure: string;

  @Column({ type: 'datetime', default: () => 'GETDATE()' })
  movement_date: Date;

  @Column({ nullable: true })
  remarks: string;

  @Column()
  user_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;
}