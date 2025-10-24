import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Role } from './role.entity';

@Entity('Users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  full_name: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password_hash: string;

  @Column({ nullable: true })
  cellphone: string;

  @Column({ nullable: true })
  address_home: string;

  @Column()
  id_cedula: string;

  @Column()
  rol_id: number;

  @ManyToOne(() => Role)
  @JoinColumn({ name: 'rol_id' })
  role: Role;

  @Column({ type: 'datetime', default: () => 'GETDATE()' })
  date_register: Date;

  @Column({ type: 'bit', default: 1 })
  state_user: boolean;
}
