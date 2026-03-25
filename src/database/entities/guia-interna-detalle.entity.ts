// guia-interna-detalle.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { GuiaInterna } from './guia-interna.entity';
import { Product } from './product.entity';

@Entity('GuiaInternaDetalle')
export class GuiaInternaDetalle {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'id_guia_interna', type: 'int' })
  id_guia_interna: number;

  @ManyToOne(() => GuiaInterna, (g) => g.detalles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_guia_interna' })
  guia: GuiaInterna;

  @Column({ name: 'producto_id', type: 'int' })
  producto_id: number;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'producto_id' })
  product: Product;

  @Column({ name: 'producto_codigo', type: 'varchar', length: 50 })
  producto_codigo: string;

  @Column({ name: 'producto_descripcion', type: 'varchar', length: 100 })
  producto_descripcion: string;

  @Column({ name: 'producto_cantidad', type: 'int' })
  producto_cantidad: number;

  @Column('decimal', { name: 'producto_precio_unitario', precision: 10, scale: 2 })
  producto_precio_unitario: number;

  @Column('decimal', { name: 'producto_total', precision: 10, scale: 2 })
  producto_total: number;
}
