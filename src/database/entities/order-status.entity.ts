// order-status.entity.ts
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('OrderStatus')
export class OrderStatus {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;
}