    import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
    import { Product } from './product.entity';

    @Entity('Categories')
    export class Category {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string; // Nombre de la categoría (por ejemplo: "Zapatillas", "Ropa deportiva", etc.)

    @Column({ nullable: true })
    description?: string; // Descripción de la categoría, opcional

    @OneToMany(() => Product, (product) => product.category)
    products: Product[]; // Relación uno a muchos con productos
    }
