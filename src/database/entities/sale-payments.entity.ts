import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Sale } from './sale.entity';
import { CashMovement } from './cash-movement.entity';
import { User } from './user.entity';

@Entity('SalePayments')
export class SalePayment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  sale_id: number;

  @ManyToOne(() => Sale, (sale) => sale.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sale_id' })
  sale: Sale;

  // efectivo, yape, plin, tarjetaDebito, tarjetaCredito, obsequio
  @Column({ type: 'varchar', length: 20 })
  method: string;

  // monto cubierto por ese método (en mixto se parte)
  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  amount: number;

  @Column({ type: 'date', nullable: true })
  payment_date: string | null;

  @Column({ type: 'int', nullable: true })
  registered_by_user_id: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'registered_by_user_id' })
  registeredBy: User | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  idempotency_key: string | null;

  // nro operación (yape/plin/tarjetas)
  @Column({ type: 'varchar', length: 50, nullable: true })
  operation_number?: string;

  // solo para efectivo
  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  cash_received: number | null;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  cash_change: number | null;

  // motivo obsequio / autorizado por / notas
  // ✅ si quieres más texto, usa 'text' en vez de varchar(255)
  @Column({ type: 'varchar', length: 255, nullable: true })
  notes: string | null;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  // Relación opcional si quieres navegar desde payment -> movimientos de caja
  @OneToMany(() => CashMovement, (m) => m.salePayment)
  cashMovements: CashMovement[];
}
