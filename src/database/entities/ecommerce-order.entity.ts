import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EcommerceOrderDetail } from './ecommerce-order-detail.entity';
import { Storefront } from './storefront.entity';

export enum EcommerceOrderStatus {
  PENDING = 'PENDIENTE',
  CONFIRMED = 'CONFIRMADO',
  DISPATCHED = 'DESPACHADO',
  DELIVERED = 'ENTREGADO',
  CANCELED = 'CANCELADO',
}

@Entity('EcommerceOrders')
export class EcommerceOrder {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 30, nullable: true, unique: true })
  order_code!: string | null;

  @Column({ type: 'varchar', length: 80, unique: true })
  idempotency_key!: string;

  @Column({ type: 'int' })
  storefront_id!: number;

  @ManyToOne(() => Storefront, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'storefront_id' })
  storefront!: Storefront;

  @Column({ type: 'int' })
  warehouse_id!: number;

  @Column({ type: 'int', nullable: true })
  customer_id!: number | null;

  @Column({ type: 'varchar', length: 150 })
  customer_name!: string;

  @Column({ type: 'varchar', length: 20 })
  customer_document!: string;

  @Column({ type: 'varchar', length: 30 })
  customer_phone!: string;

  @Column({ type: 'varchar', length: 255 })
  customer_address!: string;

  @Column({ type: 'varchar', length: 100 })
  department!: string;
  @Column({type:'varchar',length:6,nullable:true}) department_code!:string|null;

  @Column({ type: 'varchar', length: 100 })
  province!: string;
  @Column({type:'varchar',length:6,nullable:true}) province_code!:string|null;

  @Column({ type: 'varchar', length: 100 })
  district!: string;
  @Column({type:'varchar',length:6,nullable:true}) district_code!:string|null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reference?: string | null;
  @Column({type:'varchar',length:30,default:'DOMICILIO_LIMA'}) delivery_type!:'DOMICILIO_LIMA'|'AGENCIA_SHALOM';
  @Column({type:'varchar',length:40,nullable:true}) shalom_agency_id!:string|null;
  @Column({type:'varchar',length:180,nullable:true}) shalom_agency_name!:string|null;
  @Column({type:'varchar',length:80,nullable:true}) shipping_code!:string|null;

  @Column({ type: 'varchar', length: 30 })
  payment_method!: string;
  @Column({type:'varchar',length:20,default:'PENDIENTE'}) payment_status!:'PENDIENTE'|'PAGADO';

  @Column({ type: 'char', length: 3, default: 'PEN' })
  currency!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  total_amount!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  shipping_amount!: string;

  @Column({ type: 'text', nullable: true })
  observations?: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: EcommerceOrderStatus.PENDING,
  })
  status!: EcommerceOrderStatus;

  @Column({ type: 'datetime' })
  stock_committed_at!: Date;

  @Column({ type: 'datetime', nullable: true })
  stock_released_at?: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  cancellation_reason?: string | null;

  @Column({ type: 'int', nullable: true })
  canceled_by?: number | null;

  @Column({ type: 'datetime', precision: 3, nullable: true })
  canceled_at_utc?: Date | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at!: Date;

  @OneToMany(() => EcommerceOrderDetail, (detail) => detail.order)
  details!: EcommerceOrderDetail[];
}
