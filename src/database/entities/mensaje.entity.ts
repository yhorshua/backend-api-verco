import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Lead } from './lead.entity';

export enum DireccionMensajeEnum {
  ENTRANTE = 'ENTRANTE',
  SALIENTE = 'SALIENTE',
}

export enum EstadoMensajeEnum {
  PENDING = 'pending',
  RECEIVED = 'received',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
}

@Entity({
  name: 'mensaje',
})
@Index(
  'uq_mensaje_meta_message_id',
  ['meta_message_id'],
  {
    unique: true,
  },
)
@Index(
  'idx_mensaje_lead_fecha',
  ['lead_id', 'fecha'],
)
export class Mensaje {
  @PrimaryGeneratedColumn({
    name: 'id',
    type: 'int',
  })
  id!: number;

  @Column({
    name: 'lead_id',
    type: 'int',
  })
  lead_id!: number;

  @ManyToOne(
    () => Lead,
    (lead) => lead.mensajes,
    {
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
  )
  @JoinColumn({
    name: 'lead_id',
    referencedColumnName: 'id',
  })
  lead!: Lead;

  @Column({
    name: 'direccion',
    type: 'varchar',
    length: 10,
  })
  direccion!: DireccionMensajeEnum;

  @Column({
    name: 'tipo',
    type: 'varchar',
    length: 30,
  })
  tipo!: string;

  @Column({
    name: 'contenido',
    type: 'text',
  })
  contenido!: string;

  /*
   * Debe ser nullable porque un mensaje local puede guardarse
   * como pending antes de recibir el ID de Meta.
   */
  @Column({
    name: 'meta_message_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  meta_message_id!: string | null;

  @Column({
    name: 'estado',
    type: 'varchar',
    length: 20,
  })
  estado!: EstadoMensajeEnum;

  @Column({
    name: 'error_meta',
    type: 'text',
    nullable: true,
  })
  error_meta!: string | null;

  /*
   * Fecha proporcionada por Meta para mensajes entrantes
   * y cambios de estado.
   */
  @Column({
    name: 'fecha_meta',
    type: 'datetime',
    nullable: true,
  })
  fecha_meta!: Date | null;

  @CreateDateColumn({
    name: 'fecha',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fecha!: Date;
}