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

  // 🔥 NUEVOS CAMPOS
  @Column({ type: 'int', default: 0 })
  cantidad_pares: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  monto: number;

  // Relación inversa con Stock
  @OneToMany(() => Stock, stock => stock.warehouse)
  stock: Stock[];  // Asegúrate de que esta propiedad esté configurada correctamente
}
