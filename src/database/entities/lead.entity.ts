import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Asesor } from './asesor.entity';
import { LeadHistory } from './lead-history.entity';
import { Mensaje } from './mensaje.entity';

export enum OrigenLeadEnum {
  FACEBOOK_ADS_WHATSAPP = 'FACEBOOK_ADS_WHATSAPP',
  WHATSAPP_ORGANICO = 'WHATSAPP_ORGANICO',
}

export enum EstadoLeadEnum {
  NUEVO = 'NUEVO',
  ASIGNADO = 'ASIGNADO',
  CONTACTADO = 'CONTACTADO',
  COTIZADO = 'COTIZADO',
  VENDIDO = 'VENDIDO',
  DESCARTADO = 'DESCARTADO',
}

@Entity({
  name: 'leads',
})
@Index(
  'uq_leads_numero_telefono',
  ['phone_number_id', 'telefono'],
  {
    unique: true,
  },
)

export class Lead {
  @PrimaryGeneratedColumn({
    name: 'id',
    type: 'int',
  })
  id!: number;

  @Column({
    name: 'nombre',
    type: 'varchar',
    length: 100,
  })
  nombre!: string;

  @Column({
    name: 'telefono',
    type: 'varchar',
    length: 20,
  })
  telefono!: string;

  /*
   * La propiedad se llama mensaje_inicial,
   * pero en MySQL la columna sigue llamándose mensaje.
   */
  @Column({
    name: 'mensaje',
    type: 'text',
  })
  mensaje_inicial!: string;

  @Column({
    name: 'asesor_id',
    type: 'int',
    nullable: true,
  })
  asesor_id!: number | null;

  @Column({
    name: 'origen',
    type: 'varchar',
    length: 50,
    default: OrigenLeadEnum.WHATSAPP_ORGANICO,
  })
  origen!: OrigenLeadEnum;

  @Column({
    name: 'estado',
    type: 'varchar',
    length: 30,
    default: EstadoLeadEnum.NUEVO,
  })
  estado!: EstadoLeadEnum;

  @Column({
    name: 'ad_source_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  ad_source_id!: string | null;

  @Column({
    name: 'ad_source_url',
    type: 'text',
    nullable: true,
  })
  ad_source_url!: string | null;

  @Column({
    name: 'ad_headline',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  ad_headline!: string | null;

  @Column({
    name: 'ctwa_clid',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  ctwa_clid!: string | null;

  /*
   * La propiedad se llama fecha_registro,
   * pero en MySQL la columna se llama fecha.
   */
  @CreateDateColumn({
    name: 'fecha',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fecha_registro!: Date;

  @ManyToOne(
    () => Asesor,
    (asesor) => asesor.leads,
    {
      nullable: true,
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    },
  )
  @JoinColumn({
    name: 'asesor_id',
    referencedColumnName: 'id',
  })
  asesor!: Asesor | null;

  @Column({
    name: 'phone_number_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  phone_number_id!: string | null;

  @Column({
    name: 'ultima_interaccion_cliente',
    type: 'datetime',
    nullable: true,
  })
  ultima_interaccion_cliente!: Date | null;

  @Column({
    name: 'mensajes_no_leidos',
    type: 'int',
    default: 0,
  })
  mensajes_no_leidos!: number;

  @UpdateDateColumn({
    name: 'fecha_actualizacion',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  fecha_actualizacion!: Date;

  @Column({
    name: 'proxima_accion',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  proxima_accion!: string | null;

  @Column({
    name: 'fecha_proximo_seguimiento',
    type: 'datetime',
    nullable: true,
  })
  fecha_proximo_seguimiento!: Date | null;

  @Column({
    name: 'motivo_cierre',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  motivo_cierre!: string | null;

  @Column({
    name: 'fecha_cierre',
    type: 'datetime',
    nullable: true,
  })
  fecha_cierre!: Date | null;

  @OneToMany(
    () => Mensaje,
    (mensaje) => mensaje.lead,
  )
  mensajes!: Mensaje[];

  @OneToMany(
    () => LeadHistory,
    (history) => history.lead,
  )
  historial!: LeadHistory[];
}
