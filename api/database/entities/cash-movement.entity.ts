import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { CashRegisterSession } from './cash-register-session.entity';
import { Sale } from './sale.entity';
import { SalePayment } from './sale-payments.entity';

@Entity('CashMovements')
export class CashMovement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  session_id: number;

  @ManyToOne(() => CashRegisterSession, (s) => s.movements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session: CashRegisterSession;

  @Column()
  warehouse_id: number;

  @Column({ nullable: true })
  user_id: number | null;

  // SALE, INCOME, EXPENSE, WITHDRAWAL, ADJUSTMENT
  @Column({ length: 20 })
  type: string;

  // efectivo, yape, plin, tarjetaDebito, tarjetaCredito
  @Column({ length: 20 })
  payment_method: string;

  // + ingreso / - egreso
  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Column({ nullable: true, length: 50 })
  operation_number: string | null;

  // FK a Sales
  @Column({ nullable: true })
  reference_sale_id: number | null;

  @ManyToOne(() => Sale, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reference_sale_id' })
  sale: Sale | null;

  // ✅ NUEVO: FK a SalePayments
  @Column({ nullable: true, type: 'bigint' })
  reference_sale_payment_id: number | null;

  @ManyToOne(() => SalePayment, (p) => p.cashMovements, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reference_sale_payment_id' })
  salePayment: SalePayment | null;

  @Column({ nullable: true, length: 255 })
  description: string | null;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}
