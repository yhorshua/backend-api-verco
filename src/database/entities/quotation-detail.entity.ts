import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('QuotationDetails')
export class QuotationDetail {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true }) id!: number;
  @Column({ type: 'bigint', unsigned: true }) quotation_id!: number;
  @Column() product_id!: number;
  @Column({ type: 'int', nullable: true }) product_size_id!: number | null;
  @Column({ length: 50 }) sku_snapshot!: string;
  @Column({ length: 150 }) description_snapshot!: string;
  @Column({ type: 'varchar', length: 20, nullable: true }) size_snapshot!: string | null;
  @Column({ type: 'int', unsigned: true }) quantity!: number;
  @Column({ type: 'int', unsigned: true, default: 0 }) used_quantity!: number;
  @Column({ type: 'decimal', precision: 12, scale: 2 }) unit_price!: string;
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 }) discount_amount!: string;
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 }) tax_amount!: string;
  @Column({ type: 'decimal', precision: 12, scale: 2 }) line_total!: string;
  @Column({ type: 'datetime', precision: 3 }) created_at_utc!: Date;
}
