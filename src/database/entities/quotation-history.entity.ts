import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('QuotationHistory')
export class QuotationHistory {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true }) id!: number;
  @Column({ type: 'bigint', unsigned: true }) quotation_id!: number;
  @Column({ length: 30 }) action!: string;
  @Column({ type: 'varchar', length: 20, nullable: true }) previous_status!: string | null;
  @Column({ length: 20 }) new_status!: string;
  @Column() user_id!: number;
  @Column({ type: 'varchar', length: 255, nullable: true }) notes!: string | null;
  @Column({ type: 'datetime', precision: 3 }) occurred_at_utc!: Date;
  @Column({ length: 35 }) occurred_at_lima!: string;
}
