import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';

import { Client } from './client.entity';
import { User } from './user.entity';
import { OrderStatus } from './order-status.entity';
import { OrderDetail } from './order-details.entity';
import { OrderTypeEnum, PaymentMethodEnum, PaymentStatusEnum } from '../../orders/dto/orderEnum';
import { DeliveryStatusEnum } from 'src/orders/dto/statusDelivered.dto';



@Entity('Orders')
@Index(['client_id'])
@Index(['user_id'])
@Index(['order_status_id'])
@Index(['warehouse_id'])
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  proforma_number: number;

  // CLIENTE
  @Column()
  client_id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id' })
  client: Client;

  // VENDEDOR / USUARIO QUE REGISTRA EL PEDIDO
  @Column()
  user_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  // ESTADO DEL PEDIDO
  @Column()
  order_status_id: number;

  @ManyToOne(() => OrderStatus)
  @JoinColumn({ name: 'order_status_id' })
  status: OrderStatus;

  // FECHA DE REGISTRO
  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  request_date: Date;

  // APROBACIONES
  @Column({ type: 'int', nullable: true })
  approved_by: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'approved_by' })
  approvedByUser: User;

  @Column({ type: 'datetime', nullable: true })
  approval_date: Date;

  // OBSERVACIONES
  @Column({ length: 255, nullable: true })
  observations: string;

  @Column({ nullable: true, type: 'int' })
  id_guia_interna: number | null;

  @Column({ nullable: true, type: 'int' })
  id_factura: number | null;

  @Column({ nullable: true, type: 'int' })
  id_guia_remision: number | null;

  @Column({ type: 'int' })
  warehouse_id: number;

  // 🔹 RELACIÓN CON DETALLES
  @OneToMany(() => OrderDetail, (detail) => detail.order)
  details: OrderDetail[];

  // 🔥 NUEVO: TIPO DE ORDEN
  @Column({
    type: 'enum',
    enum: OrderTypeEnum,
    default: OrderTypeEnum.NORMAL,
  })
  order_type: OrderTypeEnum;

  @Column({
    type: 'enum',
    enum: PaymentStatusEnum,
    default: PaymentStatusEnum.PENDIENTE,
  })
  payment_status: PaymentStatusEnum;

  // 🔥 NUEVO: REFERENCIA DE PAGO
  @Column({ nullable: true })
  payment_reference?: string;

  // (opcional PRO)
  @Column({ nullable: true })
  shipping_address?: string;

  @Column({ nullable: true })
  shipping_reference?: string;

  @Column({
    type: 'enum',
    enum: PaymentMethodEnum,
    nullable: true,
  })
  payment_method?: PaymentMethodEnum;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'datetime', nullable: true })
  updated_at: Date;

  isDropshipping(): boolean {
    return this.order_type === OrderTypeEnum.DROPSHIPPING;
  }

  @Column({ nullable: true })
  customer_name: string;

  @Column({ nullable: true })
  customer_phone: string;

  @Column({ nullable: true })
  customer_address: string;

  @Column({ nullable: true })
  customer_reference: string;

  @Column({ default: false })
  is_dropshipping: boolean;

  @Column({ type: 'timestamp', nullable: true })
  delivered_at: Date;

  // QUIÉN ENTREGÓ
@Column({ type: 'int', nullable: true })
delivered_by: number;

@ManyToOne(() => User)
@JoinColumn({ name: 'delivered_by' })
deliveredByUser: User;

// ESTADO DE ENTREGA (logístico)
@Column({
  type: 'enum',
  enum: DeliveryStatusEnum,
  default: DeliveryStatusEnum.PENDIENTE,
})
delivery_status: DeliveryStatusEnum;

// NOTAS DE ENTREGA
@Column({ type: 'text', nullable: true })
delivery_notes: string;
}
