import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('mensaje')
export class Mensaje {

  @PrimaryGeneratedColumn()
  id!:number;


  @Column()
  lead_id!:number;


  @Column()
  direccion!:string;


  @Column()
  tipo!:string;


  @Column('text')
  contenido!:string;


  @Column()
  meta_message_id!:string;


  @CreateDateColumn()
  fecha!:Date;

}