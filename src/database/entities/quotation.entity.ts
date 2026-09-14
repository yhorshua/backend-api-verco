import { Column, Entity, PrimaryGeneratedColumn, VersionColumn } from 'typeorm';

@Entity('Quotations')
export class Quotation {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true }) id!: number;
  @Column({ length: 20, unique: true }) quote_number!: string;
  @Column({ type: 'char', length: 36, unique: true }) idempotency_key!: string;
  @Column({ type: 'smallint', unsigned: true }) quote_year!: number;
  @Column({ type: 'int', unsigned: true }) sequence_number!: number;
  @Column() client_id!: number;
  @Column() seller_id!: number;
  @Column() warehouse_id!: number;
  @Column({ type: 'char', length: 3, default: 'PEN' }) currency!: string;
  @Column({ type: 'datetime', precision: 3 }) issued_at_utc!: Date;
  @Column({ length: 35 }) issued_at_lima!: string;
  @Column({ type: 'date' }) business_date!: string;
  @Column({ type: 'date', nullable: true }) expires_on!: string | null;
  @Column({ type: 'decimal', precision: 12, scale: 2 }) subtotal!: string;
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 }) discount_total!: string;
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 }) tax_total!: string;
  @Column({ type: 'decimal', precision: 12, scale: 2 }) total!: string;
  @Column({ length: 20, default: 'ISSUED' }) status!: string;
  @Column({ type: 'varchar', length: 500, nullable: true }) observations!: string | null;
  @Column() created_by!: number;
  @Column({ type: 'int', nullable: true }) updated_by!: number | null;
  @Column({ type: 'datetime', precision: 3, nullable: true }) updated_at_utc!: Date | null;
  @Column({ type: 'int', nullable: true }) cancelled_by!: number | null;
  @Column({ type: 'datetime', precision: 3, nullable: true }) cancelled_at_utc!: Date | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) cancellation_reason!: string | null;
  @VersionColumn({ type: 'int', unsigned: true, default: 1 }) version!: number;
}
