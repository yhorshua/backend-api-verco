import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('Roles')
export class Role {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50 })
  name_role: string;
}
