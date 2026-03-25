import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Stock } from './stock.entity';  // Importa la entidad Stock

@Entity('Warehouses')
export class Warehouse {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  warehouse_name: string;

  @Column({ nullable: true })
  type: string;

  @Column({ nullable: true })
  location: string;

  @Column({ type: 'bit', default: true })
  status: boolean;

  // Relación inversa con Stock
  @OneToMany(() => Stock, stock => stock.warehouse)
  stock: Stock[];  // Asegúrate de que esta propiedad esté configurada correctamente
}
