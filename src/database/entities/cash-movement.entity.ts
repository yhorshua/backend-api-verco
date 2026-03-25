import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { CashRegisterSession } from './cash-register-session.entity';
import { Sale } from './sale.entity';
import { SalePayment } from './sale-payments.entity';

@Entity('CashMovements')
export class CashMovement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  session_id: number;

  @ManyToOne(() => CashRegisterSession, (s) => s.movements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session: CashRegisterSession;

  @Column({ type: 'int' })
  warehouse_id: number;

  // ✅ FIX: explícito para MySQL
  @Column({ type: 'int', nullable: true })
  user_id: number | null;

  // SALE, INCOME, EXPENSE, WITHDRAWAL, ADJUSTMENT
  @Column({ type: 'varchar', length: 20 })
  type: string;

  // efectivo, yape, plin, tarjetaDebito, tarjetaCredito
  @Column({ type: 'varchar', length: 20 })
  payment_method: string;

  // + ingreso / - egreso
  // ✅ TIP: en TypeORM, decimal suele venir como string al leer desde MySQL.
  // Si quieres que te llegue number en runtime, usa transformer (opcional).
  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  operation_number: string | null;

  // FK a Sales
  // ✅ FIX: tipar como int para evitar inferencia rara
  @Column({ type: 'int', nullable: true })
  reference_sale_id: number | null;

  @ManyToOne(() => Sale, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reference_sale_id' })
  sale: Sale | null;

  // FK a SalePayments
  @Column({ type: 'bigint', nullable: true })
  reference_sale_payment_id: number | null;

  @ManyToOne(() => SalePayment, (p) => p.cashMovements, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reference_sale_payment_id' })
  salePayment: SalePayment | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}
