import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('DocumentTypes')
export class DocumentType {
  @PrimaryColumn()
  code: string;

  @Column()
  description: string;
}

