import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/user.entity';

@Entity('Clients')
export class Client {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  document_type: string;

  @Column()
  document_number: string;

  @Column()
  business_name: string;

  @Column({ nullable: true })
  trade_name: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  district: string;

  @Column({ nullable: true })
  province: string;

  @Column({ nullable: true })
  department: string;

  @Column({ nullable: true, default: 'Perú' })
  country: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column()
  seller_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'seller_id' })
  seller: User;

  @Column({ type: 'datetime', default: () => 'GETDATE()' })
  created_at: Date;

  @Column({ type: 'datetime', nullable: true })
  updated_at: Date;
}
