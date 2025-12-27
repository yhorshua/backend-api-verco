import { Entity, PrimaryColumn, Column, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Warehouse } from './warehouse.entity';

@Entity('WarehouseSaleSequence')
export class WarehouseSaleSequence {
  @PrimaryColumn()
  warehouse_id: number;

  @Column({ type: 'int', default: 0 })
  last_number: number;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  @ManyToOne(() => Warehouse, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: Warehouse;
}
