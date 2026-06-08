import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('SaldoFavorCliente')
export class SaldoFavorCliente {

  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  cliente_id!: number;

  @Column('decimal', {
    precision: 10,
    scale: 2,
  })
  saldo!: number;

  @Column({
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fecha_registro!: Date;
}