import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('InventoryAdjustmentDetails')
export class InventoryAdjustmentDetail {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ type: 'bigint', unsigned: true })
  operation_id!: string;

  @Column({ type: 'int' })
  stock_id!: number;

  @Column({ type: 'int' })
  product_id!: number;

  @Column({ type: 'int', nullable: true })
  product_size_id!: number | null;

  @Column({ type: 'varchar', length: 50 })
  sku_snapshot!: string;

  @Column({ type: 'varchar', length: 150 })
  description_snapshot!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  size_snapshot!: string | null;

  @Column({ type: 'int' })
  previous_quantity!: number;

  @Column({ type: 'int' })
  new_quantity!: number;

  @Column({ type: 'int' })
  difference_quantity!: number;

  @Column({ type: 'int', unsigned: true })
  stock_version_before!: number;

  @Column({ type: 'int', unsigned: true })
  stock_version_after!: number;

  @Column({ type: 'varchar', length: 20 })
  result!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  error_message!: string | null;

  @Column({ type: 'datetime', precision: 3 })
  occurred_at_utc!: Date;
}
