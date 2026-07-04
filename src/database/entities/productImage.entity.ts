import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';
import { Product } from './product.entity';

@Entity('ProductImages')
@Index('idx_product_images_product_id', ['product_id'])
@Index('idx_product_images_sort_order', ['product_id', 'sort_order'])
export class ProductImage {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'int' })
    product_id!: number;

    @Column({
        type: 'varchar',
        length: 500,
        collation: 'utf8mb4_unicode_ci',
    })
    image_url!: string;

    @Column({
        type: 'varchar',
        length: 150,
        collation: 'utf8mb4_unicode_ci',
        nullable: true,
    })
    alt_text?: string;

    @Column({
        type: 'int',
        default: 1,
    })
    sort_order!: number;

    @Column({
        type: 'bit',
        width: 1,
        default: () => "b'0'",
    })
    is_primary!: boolean;

    @Column({
        type: 'bit',
        width: 1,
        default: () => "b'1'",
    })
    status!: boolean;

    @CreateDateColumn({
        type: 'datetime',
        name: 'created_at',
    })
    created_at!: Date;

    @UpdateDateColumn({
        type: 'datetime',
        name: 'updated_at',
    })
    updated_at!: Date;

    @ManyToOne(() => Product, (product) => product.images, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'product_id' })
    product!: Product;
}