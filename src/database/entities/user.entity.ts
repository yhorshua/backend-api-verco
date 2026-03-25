import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Role } from './role.entity';
import { Warehouse } from './warehouse.entity';
import { Attendance } from './marcacion.entity';

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

  @Column({ nullable: true })
  id_cedula: string;

  @Column()
  rol_id: number;

  @ManyToOne(() => Role)
  @JoinColumn({ name: 'rol_id' })
  role: Role;

  @Column({ type: 'datetime', default: () => 'GETDATE()' })
  date_register: Date;

  @Column({ type: 'bit', default: true })
  state_user: boolean;

  @Column({ nullable: true })
  warehouse_id: number;

  @ManyToOne(() => Warehouse)
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: Warehouse;

  @Column({ type: 'decimal', default: 0 })
  salario: number;

  @OneToMany(() => Attendance, attendance => attendance.user)
  attendances: Attendance[];


}