import {
  Column,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Lead } from './lead.entity';
import { User } from './user.entity';

@Entity({
  name: 'asesor',
})
export class Asesor {
  @PrimaryGeneratedColumn({
    name: 'id',
    type: 'int',
  })
  id!: number;

  @Column({
    name: 'user_id',
    type: 'int',
    unique: true,
  })
  user_id!: number;

  @OneToOne(
    () => User,
    (user) => user.asesor,
    {
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
  )

  @JoinColumn({
    name: 'user_id',
    referencedColumnName: 'id',
  })
  user!: User;

  @Column({
    name: 'activo',
    type: 'boolean',
    default: true,
  })
  activo!: boolean;

  @Column({
    name: 'fecha_ultima_asignacion',
    type: 'datetime',
    nullable: true,
  })
  fecha_ultima_asignacion!: Date | null;

  @OneToMany(
    () => Lead,
    (lead) => lead.asesor,
  )
  leads!: Lead[];
}