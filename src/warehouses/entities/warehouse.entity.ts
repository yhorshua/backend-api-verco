import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Stock } from '../../products/entities/stock.entity';

@Entity('Warehouses')
export class Warehouse {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  warehouse_name: string;

  @Column({ nullable: true })
  type: string;

  @Column({ nullable: true })
  location: string;

  @Column({ type: 'bit', default: true })
  status: boolean;

  // Relación inversa con Stock
  @OneToMany(() => Stock, stock => stock.warehouse)
  stock: Stock[];
}