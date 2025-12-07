import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('Series')
export class Series {
  @PrimaryColumn()
  code: string;

  @Column({ nullable: true })
  description_serie: string;

  @Column({ nullable: true })
  size_from: string;

  @Column({ nullable: true })
  size_up: string;

  @Column({ type: 'bit', default: true })
  status: boolean;
}