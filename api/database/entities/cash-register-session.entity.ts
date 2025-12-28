import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Warehouse } from './warehouse.entity';
import { User } from './user.entity';
import { CashMovement } from './cash-movement.entity';

@Entity('CashRegisterSessions')
export class CashRegisterSession {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  warehouse_id: number;

  @ManyToOne(() => Warehouse, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: Warehouse;

  @Column()
  user_id: number;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  opened_at: Date;

  @Column({ type: 'datetime', nullable: true })
  closed_at: Date | null;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  opening_cash: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  closing_cash_counted: number | null;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  closing_expected_cash: number | null;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  difference: number | null;

  @Column({ length: 10, default: 'OPEN' })
  status: 'OPEN' | 'CLOSED';

  // CashRegisterSession entity
  @Column({ type: 'varchar', length: 255, nullable: true })
  notes: string | null;



  @OneToMany(() => CashMovement, (m) => m.session)
  movements: CashMovement[];
}
