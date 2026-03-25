import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './user.entity';
import { DocumentType } from './document-types.entity';

@Index('UQ_CLIENT_DOC', ['document_type', 'document_number'], { unique: true })
@Entity('Clients')
export class Client {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 10 })
  document_type: string;

  @ManyToOne(() => DocumentType, { nullable: false })
  @JoinColumn({ name: 'document_type', referencedColumnName: 'code' })
  docType: DocumentType;

  @Column({ type: 'varchar', length: 30 })
  document_number: string;

  @Column({ type: 'varchar', length: 180 })
  business_name: string;

  @Column({ type: 'varchar', length: 180, nullable: true })
  trade_name: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  district: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  province: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  department: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true, default: 'Perú' })
  country: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  email: string | null;

  @Column({ type: 'int', nullable: true })
  seller_id: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'seller_id' })
  seller: User | null;

  @Column({ type: 'datetime', nullable: true })
  last_order_at: Date | null;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'datetime', nullable: true })
  updated_at: Date | null;
}
