import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { Warehouse } from './warehouse.entity';
import { User } from './user.entity';
import { SaleDetail } from './sale-detail.entity';
import { SalePayment } from './sale-payments.entity';
import { SaleReturn } from './sale-return.entity';
import { Client } from './client.entity';

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

  @ManyToOne(() => Client, { nullable: true })
  @JoinColumn({ name: 'customer_id' })
  customer: Client | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  customer_name: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes: string | null;

  // ✅ MySQL: CURRENT_TIMESTAMP
  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  sale_date: Date;

  @Column('decimal', { precision: 10, scale: 2 })
  total_amount: number;

  @Column({ length: 20, nullable: true })
  payment_method: string;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  monto_adelanto: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  metodo_pago_adelanto: 'efectivo' | 'yape' | null;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  monto_restante: number;

  @Column({ type: 'date', nullable: true })
  fecha_proximo_pago: string | null;

  @Column({ type: 'varchar', length: 20, default: 'PAID' })
  payment_status: 'PENDING' | 'PAID';

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
