import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Warehouse } from './warehouse.entity';

@Entity('Storefronts')
export class Storefront {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 80, unique: true })
  slug!: string;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ type: 'int' })
  warehouse_id!: number;

  @ManyToOne(() => Warehouse, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse!: Warehouse;

  @Column({ type: 'char', length: 3, default: 'PEN' })
  currency!: string;

  @Column({ type: 'int', unsigned: true, default: 1 })
  cache_version!: number;

  @Column({ type: 'int', unsigned: true, default: 60 })
  cache_ttl_seconds!: number;

  @Column({ type: 'bit', default: () => "b'1'" })
  status!: boolean;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at!: Date;
}
