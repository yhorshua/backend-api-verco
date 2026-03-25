import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('attendance')
export class Attendance {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  user_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'datetime' })
  fecha: Date;

  @Column({ nullable: true, type: 'datetime' })
  hora_entrada: Date | null;

  @Column({ nullable: true, type: 'datetime' })
  hora_salida: Date | null;

  @Column({ type: 'enum', enum: ['entrada', 'salida'] })
  tipo: 'entrada' | 'salida';

  @Column({ type: 'bit', default: true })
  estado: boolean;

  @Column({ nullable: true })
  ubicacion: string; // La ubicación del empleado en el momento de la marca
}
