import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { Stock } from './entities/stock.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Stock)
    private readonly stockRepo: Repository<Stock>,
  ) { }

  async create(createProductDto: CreateProductDto): Promise<Product> {
    const product = this.productRepo.create(createProductDto);
    return await this.productRepo.save(product);
  }

  async findAll(): Promise<Product[]> {
    return await this.productRepo.find({ relations: ['sizes', 'series'] });
  }

  async findOne(id: number): Promise<Product> {
    const product = await this.productRepo.findOne({
      where: { id },
      relations: ['sizes', 'series'],
    });
    if (!product) throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    return product;
  }

  async update(id: number, updateProductDto: UpdateProductDto): Promise<Product> {
    const product = await this.findOne(id);
    Object.assign(product, updateProductDto);
    return await this.productRepo.save(product);
  }

  async disable(id: number): Promise<Product> {
    const product = await this.findOne(id);
    if (!product) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    }
    product.status = false; // deshabilitado
    return await this.productRepo.save(product);
  }

  /**
   * Consultar productos disponibles en un almacén específico
   */
  async findByWarehouse(warehouseId: number): Promise<Product[]> {
    return await this.productRepo
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.sizes', 'sizes')
      .leftJoinAndSelect('product.series', 'series')
      .leftJoin('product.stock', 'stock')
      .addSelect(['stock.quantity', 'stock.unit_of_measure', 'stock.warehouse_id'])
      .where('stock.warehouse_id = :warehouseId', { warehouseId })
      .andWhere('product.status = 1') // solo activos
      .getMany();
  }
}