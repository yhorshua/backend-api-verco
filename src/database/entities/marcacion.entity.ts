import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('attendance')
export class Attendance {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'datetime' })
  fecha: Date;

  @Column({ nullable: true, type: 'datetime' })
  hora_entrada: Date;

  @Column({ nullable: true, type: 'datetime' })
  hora_salida: Date;

  @Column({ type: 'enum', enum: ['entrada', 'salida'] })
  tipo: string;

  @Column({ type: 'bit', default: true })
  estado: boolean;

  @Column({ nullable: true })
  ubicacion: string; // La ubicación del empleado en el momento de la marca
}
