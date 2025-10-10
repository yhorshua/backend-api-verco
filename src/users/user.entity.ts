import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Role } from './role.entity';

@Entity('Users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  full_name: string;

  @Column({ length: 8, nullable: true })
  id_cedula: string;

  @Column({ length: 100 })
  address_home: string;

  @Column({ length: 100, unique: true })
  email: string;

  @Column({ length: 255 })
  password_hash: string;

  @Column({ length: 9, nullable: true })
  cellphone: string;

  // 👇 ESTA ES LA CLAVE
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
