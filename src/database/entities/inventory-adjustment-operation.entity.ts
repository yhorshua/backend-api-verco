import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('InventoryAdjustmentOperations')
export class InventoryAdjustmentOperation {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ type: 'varchar', length: 32, unique: true })
  operation_code!: string;

  @Column({ type: 'varchar', length: 36, unique: true })
  idempotency_key!: string;

  @Column({ type: 'char', length: 64 })
  request_hash!: string;

  @Column({ type: 'int' })
  warehouse_id!: number;

  @Column({ type: 'int' })
  user_id!: number;

  @Column({ type: 'varchar', length: 100 })
  user_name_snapshot!: string;

  @Column({ type: 'varchar', length: 50 })
  role_snapshot!: string;

  @Column({ type: 'varchar', length: 40 })
  reason_code!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  observation!: string | null;

  @Column({ type: 'varchar', length: 64 })
  correlation_id!: string;

  @Column({ type: 'varchar', length: 45, nullable: true })
  request_ip!: string | null;

  @Column({ type: 'varchar', length: 20 })
  status!: string;

  @Column({ type: 'int' })
  item_count!: number;

  @Column({ type: 'datetime', precision: 3 })
  occurred_at_utc!: Date;

  @Column({ type: 'varchar', length: 35 })
  occurred_at_lima!: string;

  @Column({ type: 'date' })
  business_date!: string;
}
