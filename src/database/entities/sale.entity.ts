import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { Warehouse } from './warehouse.entity';
import { User } from './user.entity';
import { SaleDetail } from './sale-detail.entity';
import { SalePayment } from './sale-payments.entity';
import { SaleReturn } from './sale-return.entity';

@Index(['sale_code', 'warehouse'], { unique: true })
@Entity('Sales')
export class Sale {
  @PrimaryGeneratedColumn()
  id: number;

  // ✅ NUEVO: código por tienda V00001
  @Column({ length: 10 })
  sale_code: string;

  @Column()
  warehouse_id: number;

  @ManyToOne(() => Warehouse)
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: Warehouse;

  @Column()
  user_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ nullable: true })
  customer_id: number;

  // ✅ MySQL: CURRENT_TIMESTAMP
  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  sale_date: Date;

  @Column('decimal', { precision: 10, scale: 2 })
  total_amount: number;

  @Column({ length: 20, nullable: true })
  payment_method: string;

  @OneToMany(() => SaleDetail, detail => detail.sale)
  details: SaleDetail[];

  @OneToMany(() => SalePayment, (p) => p.sale)
  payments: SalePayment[];

  @Column({
    type: 'enum',
    enum: ['completed', 'partial_return', 'returned'],
    default: 'completed'
  })
  status: string;

  @OneToMany(() => SaleReturn, r => r.sale)
  returns: SaleReturn[];

}
