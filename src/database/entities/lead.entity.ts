import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Asesor } from './asesor.entity';

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
@Index('idx_leads_telefono', ['telefono'])
@Index(
  'uq_leads_meta_message_id',
  ['meta_message_id'],
  {
    unique: true,
  },
)
export class Lead {
  @PrimaryGeneratedColumn({
    name: 'id',
    type: 'int',
  })
  id: number;

  @Column({
    name: 'nombre',
    type: 'varchar',
    length: 100,
  })
  nombre: string;

  @Column({
    name: 'telefono',
    type: 'varchar',
    length: 20,
  })
  telefono: string;

  /*
   * La propiedad se llama mensaje_inicial,
   * pero en MySQL la columna sigue llamándose mensaje.
   */
  @Column({
    name: 'mensaje',
    type: 'text',
  })
  mensaje_inicial: string;

  @Column({
    name: 'meta_message_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  meta_message_id: string | null;

  @Column({
    name: 'asesor_id',
    type: 'int',
    nullable: true,
  })
  asesor_id: number | null;

  @Column({
    name: 'origen',
    type: 'varchar',
    length: 50,
    default: OrigenLeadEnum.WHATSAPP_ORGANICO,
  })
  origen: OrigenLeadEnum;

  @Column({
    name: 'estado',
    type: 'varchar',
    length: 30,
    default: EstadoLeadEnum.NUEVO,
  })
  estado: EstadoLeadEnum;

  @Column({
    name: 'ad_source_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  ad_source_id: string | null;

  @Column({
    name: 'ad_source_url',
    type: 'text',
    nullable: true,
  })
  ad_source_url: string | null;

  @Column({
    name: 'ad_headline',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  ad_headline: string | null;

  @Column({
    name: 'ctwa_clid',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  ctwa_clid: string | null;

  /*
   * La propiedad se llama fecha_registro,
   * pero en MySQL la columna se llama fecha.
   */
  @CreateDateColumn({
    name: 'fecha',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fecha_registro: Date;

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
  asesor: Asesor | null;
}