import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Sale } from './sale.entity';
import { SaleDetail } from './sale-detail.entity';
import { Product } from './product.entity';
import { Warehouse } from './warehouse.entity';
import { User } from './user.entity';

@Entity('SaleReturns')
export class SaleReturn {

  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  sale_id: number;

  @ManyToOne(() => Sale)
  @JoinColumn({ name: 'sale_id' })
  sale: Sale;

  @Column()
  sale_detail_id: number;

  @ManyToOne(() => SaleDetail)
  @JoinColumn({ name: 'sale_detail_id' })
  saleDetail: SaleDetail;

  @Column()
  product_id: number;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;

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

  @Column('decimal', { precision: 10, scale: 2 })
  quantity: number;

  @Column('decimal', { precision: 10, scale: 2 })
  unit_price: number;

  @Column('decimal', { precision: 10, scale: 2 })
  total_refund: number;

  @Column({ nullable: true })
  reason: string;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}