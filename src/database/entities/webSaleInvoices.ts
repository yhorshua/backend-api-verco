import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  JoinColumn,
  Unique
} from 'typeorm';

import { WebSale } from './webSale.entity';

@Entity('WebSaleInvoices')
@Unique(['serie', 'correlative'])
@Unique(['sale_id'])
export class WebSaleInvoice {
  @PrimaryGeneratedColumn()
  id!: number;

  @OneToOne(() => WebSale)
  @JoinColumn({ name: 'sale_id' })
  sale!: WebSale;

  @Column()
  sale_id!: number;

  @Column({ default: '03' })
  document_type!: string;

  @Column()
  serie!: string;

  @Column()
  correlative!: number;

  @Column()
  document_number!: string;

  @Column()
  file_name!: string;

  @Column({ nullable: true })
  efact_ticket!: string;

  @Column({ default: 'ENVIADO' })
  status!: string;

  @Column({ type: 'json', nullable: true })
  request_payload!: any;

  @Column({ type: 'json', nullable: true })
  efact_response!: any;

  @CreateDateColumn()
  created_at!: Date;
}