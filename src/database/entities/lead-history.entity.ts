import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { EstadoLeadEnum, Lead } from './lead.entity';
import { User } from './user.entity';

@Entity({ name: 'lead_historial' })
@Index('idx_lead_historial_lead_fecha', ['lead_id', 'fecha'])
export class LeadHistory {
  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint' })
  id!: string;

  @Column({ name: 'lead_id', type: 'int' })
  lead_id!: number;

  @ManyToOne(() => Lead, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'lead_id', referencedColumnName: 'id' })
  lead!: Lead;

  @Column({ name: 'usuario_id', type: 'int' })
  usuario_id!: number;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id', referencedColumnName: 'id' })
  usuario!: User;

  @Column({ name: 'estado_anterior', type: 'varchar', length: 30 })
  estado_anterior!: EstadoLeadEnum;

  @Column({ name: 'estado_nuevo', type: 'varchar', length: 30 })
  estado_nuevo!: EstadoLeadEnum;

  @Column({ name: 'observacion', type: 'varchar', length: 500, nullable: true })
  observacion!: string | null;

  @CreateDateColumn({
    name: 'fecha',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fecha!: Date;
}
