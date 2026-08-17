import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Lead } from './lead.entity';


@Entity({
  name:'asesor',
})
export class Asesor {


  @PrimaryGeneratedColumn({
    name:'id',
    type:'int',
  })
  id!:number;



  @Column({
    name:'nombre',
    type:'varchar',
    length:100,
  })
  nombre!:string;



  @Column({
    name:'usuario',
    type:'varchar',
    length:50,
    unique:true,
  })
  usuario!:string;



  @Column({
    name:'activo',
    type:'boolean',
    default:true,
  })
  activo!:boolean;



  @Column({
    name:'fecha_ultima_asignacion',
    type:'timestamp',
    nullable:true,
  })
  fecha_ultima_asignacion!:Date | null;



  @OneToMany(
    ()=>Lead,
    (lead)=>lead.asesor,
  )
  leads!:Lead[];

}