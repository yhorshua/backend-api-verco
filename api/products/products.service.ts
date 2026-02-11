import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Product } from '../database/entities/product.entity';
import { ProductSize } from '../database/entities/product-size.entity';
import { Stock } from '../database/entities/stock.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Series } from 'api/database/entities/series.entity';
import { Category } from 'api/database/entities/categories.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(ProductSize)
    private readonly productSizeRepo: Repository<ProductSize>,
    @InjectRepository(Stock)
    private readonly stockRepo: Repository<Stock>,
    @InjectRepository(Series)
    private readonly seriesRepo: Repository<Series>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
  ) { }


  async createMany(createProductDtos: CreateProductDto[]): Promise<Product[]> {
  const savedProducts: Product[] = [];

  return this.productRepo.manager.transaction(async (manager: EntityManager) => {
    for (const createProductDto of createProductDtos) {
      // Buscar la categoría
      const category = await manager.findOne(Category, { where: { id: createProductDto.categoryId } });

      if (!category) {
        throw new NotFoundException(`Categoría ${createProductDto.categoryId} no encontrada`);
      }

      // 1) Verificar si el producto ya existe por el código de artículo
      let product = await manager.findOne(Product, { where: { article_code: createProductDto.article_code } });

      if (product) {
        // Si el producto ya existe, actualizamos los campos
        product.article_description = createProductDto.article_description;
        product.article_series = createProductDto.article_series;
        product.type_origin = createProductDto.type_origin;
        product.manufacturing_cost = createProductDto.manufacturing_cost;
        product.unit_price = createProductDto.unit_price;
        product.category = category;
        
        // 2) Guardar el producto actualizado
        product = await manager.save(Product, product);
      } else {
        // Si no existe, crear el producto
        product = manager.create(Product, {
          article_code: createProductDto.article_code,
          article_description: createProductDto.article_description,
          article_series: createProductDto.article_series,
          type_origin: createProductDto.type_origin,
          manufacturing_cost: createProductDto.manufacturing_cost,
          unit_price: createProductDto.unit_price,
          selling_price: createProductDto.selling_price,
          brand_name: createProductDto.brand_name,
          model_code: createProductDto.model_code,
          category,
          material_type: createProductDto.material_type,
          color: createProductDto.color,
          stock_minimum: createProductDto.stock_minimum,
          product_image: createProductDto.product_image,
        });

        // 3) Guardar el producto nuevo
        product = await manager.save(Product, product);
      }

      // 4) Crear y asociar las tallas del producto
      for (const size of createProductDto.sizes) {
        const productSize = manager.create(ProductSize, {
          product: product,
          size: size,
          lot_pair: createProductDto.lot_pair, // Si es necesario
        });

        // 5) Guardar la talla
        await manager.save(ProductSize, productSize);
      }

      savedProducts.push(product);
    }

    return savedProducts;
  });
}


  async findAll(): Promise<Product[]> {
    return await this.productRepo.find({ relations: ['sizes', 'series', 'category'] });
  }

  async findOne(id: number): Promise<Product> {
    const product = await this.productRepo.findOne({
      where: { id },
      relations: ['sizes', 'series', 'category'],
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
  async findByCategoryAndWarehouse(categoryId: number | null, warehouseId: number, serie: string | null): Promise<Product[]> {
    const queryBuilder = this.productRepo.createQueryBuilder('product')
      .leftJoinAndSelect('product.sizes', 'sizes')
      .leftJoinAndSelect('product.series', 'series')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.stock', 'stock')
      .leftJoinAndSelect('stock.productSize', 'stockSize') // Añadido el JOIN para stockSize

    // Filtro por warehouseId (si se pasa el valor)
    queryBuilder.andWhere('stock.warehouse_id = :warehouseId', { warehouseId });

    // Filtro por categoryId (si se pasa el valor)
    if (categoryId !== null) {
      queryBuilder.andWhere('product.category_id = :categoryId', { categoryId });
    }

    if (serie) {
    queryBuilder.andWhere('product.series.code = :serie', { serie });
  }
    // Filtrar productos activos
    queryBuilder.andWhere('product.status = 1');

    return await queryBuilder.getMany();
  }

  async findProductsWithSizes(): Promise<any[]> {
    // Realiza la consulta básica
    const products = await this.productRepo
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.sizes', 'sizes')
      .leftJoinAndSelect('product.series', 'series')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('sizes.stock', 'stock')
      .where('product.id IS NOT NULL')  // Filtrar productos con id no nulo
      .andWhere('product.series.code IS NOT NULL')  // Filtrar productos sin serie válida
      .getMany();

    // Procesa los productos y filtra cualquier producto que tenga valores inválidos
    const validProducts = products.filter(product => {
      // Verifica que el producto tenga un ID y serie válida
      return product.id && product.series && product.series.code;
    });

    return validProducts.map(product => {
      const seriesCode = product.series.code;
      const productDescription = product.article_description;

      // Creamos un objeto para cada producto con las tallas y el ID
      const sizesMap = product.sizes.reduce((acc, size) => {
        acc[size.size] = size.id;  // El ID de la talla correspondiente
        return acc;
      }, {});

      return {
        product_id: product.id,
        series_id: seriesCode,
        article_code: product.article_code,
        article_description: productDescription,
        sizes: sizesMap,  // Mapa de tallas con su respectivo ID
      };
    });
  }

  // Método para consultar por código o descripción
  async findByCode(query: string): Promise<any> {
    // Realizar la búsqueda solo por código de artículo
    const product = await this.productRepo
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.sizes', 'sizes')  // Unir las tallas
      .leftJoinAndSelect('product.series', 'series')  // Unir la serie
      .leftJoinAndSelect('product.category', 'category')  // Unir la categoría
      .where('UPPER(product.article_code) = :query', {
        query: query.toUpperCase(),  // Búsqueda exacta por código de artículo
      })
      .getOne();

    if (!product) {
      throw new NotFoundException(
        `Producto con código "${query}" no encontrado`,
      );
    }

    // Retornar la información del producto con sus detalles
    return {
      product_id: product.id,
      article_code: product.article_code,
      article_description: product.article_description,
      article_series: product.article_series,
      material_type: product.material_type,
      color: product.color,
      stock_minimum: product.stock_minimum,
      product_image: product.product_image,
      price: product.manufacturing_cost,
      category: product.category,
      series: product.series,
      sizes: product.sizes,
    };
  }

}