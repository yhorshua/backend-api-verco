import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Sale } from './sale.entity';
import { CashMovement } from './cash-movement.entity';

@Entity('SalePayments')
export class SalePayment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  sale_id: number;

  @ManyToOne(() => Sale, (sale) => sale.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sale_id' })
  sale: Sale;

  // efectivo, yape, plin, tarjetaDebito, tarjetaCredito, obsequio
  @Column({ length: 20 })
  method: string;

  // monto cubierto por ese método (en mixto se parte)
  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  amount: number;

  // nro operación (yape/plin/tarjetas)
  @Column({ nullable: true, length: 50 })
  operation_number: string | null;

  // solo para efectivo
  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  cash_received: number | null;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  cash_change: number | null;

  // motivo obsequio / autorizado por / notas
  @Column({ nullable: true, length: 255 })
  notes: string | null;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  // Relación opcional si quieres navegar desde payment -> movimientos de caja
  @OneToMany(() => CashMovement, (m) => m.salePayment)
  cashMovements: CashMovement[];
}
