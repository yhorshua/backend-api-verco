import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { Product } from '../database/entities/product.entity';
import { ProductSize } from '../database/entities/product-size.entity';
import { Stock } from '../database/entities/stock.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Series } from 'src/database/entities/series.entity';
import { Category } from 'src/database/entities/categories.entity';
import * as XLSX from 'xlsx';
import { UpdateProductPriceItemDto, UpdateProductPricesDto } from './dto/update-product-prices.dto';

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

    // 🔒 Campos permitidos
    const allowedFields = [
      'article_code',
      'article_description',
      'type_origin',
      'manufacturing_cost',
      'unit_price',
      'factory_price',
      'dropshipping_price',
      'wholesale_price',
      'brand_name',
      'model_code',
      'material_type',
      'color',
      'stock_minimum',
      'product_image'
    ];

    for (const key in updateProductDto) {
      const value = updateProductDto[key];

      if (value === undefined || value === null) continue;

      // 🔒 Validar campos permitidos
      if (!allowedFields.includes(key)) continue;

      // 💰 Validación precios
      if (
        ['unit_price', 'factory_price', 'dropshipping_price', 'wholesale_price'].includes(key)
        && value < 0
      ) {
        throw new BadRequestException(`El campo ${key} no puede ser negativo`);
      }

      // 🔁 Validar código único
      if (key === 'article_code') {
        const exists = await this.productRepo.findOne({
          where: { article_code: value }
        });

        if (exists && exists.id !== id) {
          throw new BadRequestException('El código ya existe');
        }
      }

      product[key] = value;
    }

    // =========================
    // 🔴 RELACIONES
    // =========================

    // ✅ CATEGORY
    if (updateProductDto.categoryId) {
      const category = await this.categoryRepo.findOne({
        where: { id: updateProductDto.categoryId }
      });

      if (!category) {
        throw new NotFoundException('Categoría no encontrada');
      }

      product.category = category;
    }

    // ✅ SERIES
    if (updateProductDto.article_series) {
      const series = await this.seriesRepo.findOne({
        where: { code: updateProductDto.article_series }
      });

      if (!series) {
        throw new NotFoundException('Serie no encontrada');
      }

      product.series = series;
      product.article_series = series.code; // importante mantener consistencia
    }

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
    const products = await this.productRepo
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.sizes', 'sizes')
      .leftJoinAndSelect('product.series', 'series')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('sizes.stock', 'stock')
      .where('product.id IS NOT NULL')
      .andWhere('series.code IS NOT NULL')
      .getMany();

    return products.map(product => {

      const sizesMap = product.sizes.reduce((acc, size) => {
        acc[size.size] = {
          size_id: size.id,
          size: size.size
        };
        return acc;
      }, {});

      return {
        product_id: product.id,

        article_code: product.article_code,
        article_description: product.article_description,
        article_series: product.article_series,
        type_origin: product.type_origin,

        manufacturing_cost: product.manufacturing_cost,
        unit_price: product.unit_price,

        brand_name: product.brand_name,
        model_code: product.model_code,
        material_type: product.material_type,
        color: product.color,

        // serie
        series: {
          code: product.series?.code,
          name: product.series?.description_serie
        },

        // categoría
        category: {
          id: product.category?.id,
          name: product.category?.name
        },

        // tallas
        sizes: sizesMap
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


  async importStockExcel(
    warehouseId: number,
    file: any,
  ) {

    return await this.stockRepo.manager.transaction(
      async (manager) => {

        const workbook = XLSX.read(file.buffer, {
          type: 'buffer',
        });

        const sheetName = workbook.SheetNames[0];

        const worksheet =
          workbook.Sheets[sheetName];

        const rows: any[] =
          XLSX.utils.sheet_to_json(
            worksheet,
            {
              defval: 0,
            },
          );

        const productsNotFound: string[] = [];

        const sizesNotFound: {
          articleCode: string;
          size: string;
        }[] = [];

        let updated = 0;
        let inserted = 0;

        /**
         * Obtener códigos únicos
         */
        const articleCodes = [
          ...new Set(
            rows
              .map(row =>
                String(
                  row['Código'] ??
                  row['Codigo'] ??
                  '',
                ).trim(),
              )
              .filter(Boolean),
          ),
        ];

        /**
         * Productos + tallas
         */
        const products =
          await manager.find(Product, {
            where: {
              article_code:
                In(articleCodes),
            },
            relations: ['sizes'],
          });

        /**
         * Map de productos
         */
        const productMap =
          new Map<string, Product>();

        products.forEach(product => {

          productMap.set(
            product.article_code,
            product,
          );

        });

        /**
         * Map de tallas
         */
        const sizeMap =
          new Map<
            string,
            ProductSize
          >();

        products.forEach(product => {

          product.sizes.forEach(size => {

            sizeMap.set(
              `${product.article_code}_${size.size}`,
              size,
            );

          });

        });

        /**
         * Stock actual del warehouse
         */
        const stocks =
          await manager.find(Stock, {
            where: {
              warehouse_id:
                warehouseId,
            },
          });

        /**
         * Map stock
         */
        const stockMap =
          new Map<string, Stock>();

        stocks.forEach(stock => {

          stockMap.set(
            `${stock.product_id}_${stock.product_size_id}`,
            stock,
          );

        });

        const stocksToUpdate: Stock[] = [];

        const stocksToInsert: Stock[] = [];

        /**
         * Procesar Excel
         */
        for (const row of rows) {

          const articleCode =
            String(
              row['Código'] ??
              row['Codigo'] ??
              '',
            ).trim();

          if (!articleCode) {
            continue;
          }

          const product =
            productMap.get(
              articleCode,
            );

          if (!product) {

            productsNotFound.push(
              articleCode,
            );

            continue;
          }

          /**
           * Recorrer columnas
           */
          for (const column of Object.keys(row)) {

            /**
             * Ignorar columna código
             */
            if (
              column === 'Código' ||
              column === 'Codigo'
            ) {
              continue;
            }

            const sizeValue =
              String(column).trim();

            const quantity =
              Number(
                row[column] ?? 0,
              );

            const productSize =
              sizeMap.get(
                `${articleCode}_${sizeValue}`,
              );

            if (!productSize) {

              sizesNotFound.push({
                articleCode,
                size: sizeValue,
              });

              continue;
            }

            const stockKey =
              `${product.id}_${productSize.id}`;

            const existingStock =
              stockMap.get(
                stockKey,
              );

            /**
             * UPDATE
             */
            if (existingStock) {

              existingStock.quantity =
                quantity;

              stocksToUpdate.push(
                existingStock,
              );

              updated++;

            }
            /**
             * INSERT
             */
            else {

              const newStock =
                manager.create(
                  Stock,
                  {
                    warehouse_id:
                      warehouseId,

                    product_id:
                      product.id,

                    product_size_id:
                      productSize.id,

                    quantity,

                    unit_of_measure:
                      'PAR',
                  },
                );

              stocksToInsert.push(
                newStock,
              );

              inserted++;
            }
          }
        }

        /**
         * Guardar updates
         */
        if (
          stocksToUpdate.length > 0
        ) {

          await manager.save(
            Stock,
            stocksToUpdate,
          );
        }

        /**
         * Guardar inserts
         */
        if (
          stocksToInsert.length > 0
        ) {

          await manager.save(
            Stock,
            stocksToInsert,
          );
        }

        return {

          warehouseId,

          totalRows:
            rows.length,

          updated,

          inserted,

          productsNotFound:
            [
              ...new Set(
                productsNotFound,
              ),
            ],

          sizesNotFound,

          message:
            'Importación de stock completada correctamente',
        };
      },
    );
  }

  async findVercoZapatillas(): Promise<any[]> {
    const products = await this.productRepo
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.sizes', 'sizes')
      .leftJoinAndSelect('product.series', 'series')
      .leftJoinAndSelect('product.category', 'category')
      .where('LOWER(product.brand_name) = LOWER(:brand)', {
        brand: 'VERCO',
      })
      .andWhere('LOWER(category.name) = LOWER(:categoryName)', {
        categoryName: 'ZAPATILLAS',
      })
      .andWhere('product.status = :status', {
        status: true,
      })
      .orderBy('product.article_code', 'ASC')
      .getMany();

    return products.map((product) => ({
      id: product.id,
      article_code: product.article_code,
      article_description: product.article_description,
      article_series: product.article_series,

      brand_name: product.brand_name,
      model_code: product.model_code,
      material_type: product.material_type,
      color: product.color,

      category: {
        id: product.category?.id,
        name: product.category?.name,
      },

      series: {
        code: product.series?.code,
        name: product.series?.description_serie,
      },

      prices: {
        manufacturing_cost: Number(product.manufacturing_cost ?? 0),
        unit_price: Number(product.unit_price ?? 0),
        factory_price: Number(product.factory_price ?? 0),
        dropshipping_price: Number(product.dropshipping_price ?? 0),
        wholesale_price: Number(product.wholesale_price ?? 0),
      },

      sizes: product.sizes?.map((size) => ({
        id: size.id,
        size: size.size,
        lot_pair: size.lot_pair,
      })),
    }));
  }

  async updateManyProductPrices(dto: UpdateProductPricesDto) {
    if (!dto.products || dto.products.length === 0) {
      throw new BadRequestException('Debe enviar al menos un producto');
    }

    const allowedPriceFields: Array<keyof UpdateProductPriceItemDto> = [
      'manufacturing_cost',
      'unit_price',
      'factory_price',
      'dropshipping_price',
      'wholesale_price',
    ];

    return await this.productRepo.manager.transaction(async (manager) => {
      const updatedProducts: any[] = [];
      const productsNotFound: number[] = [];

      for (const item of dto.products) {
        const product = await manager.findOne(Product, {
          where: {
            id: item.id,
          },
          relations: ['category'],
        });

        if (!product) {
          productsNotFound.push(item.id);
          continue;
        }

        // Seguridad: solo permitir actualizar productos VERCO + ZAPATILLAS
        const isVerco =
          String(product.brand_name ?? '').toUpperCase() === 'VERCO';

        const isZapatillas =
          String(product.category?.name ?? '').toUpperCase() === 'ZAPATILLAS';

        if (!isVerco || !isZapatillas) {
          throw new BadRequestException(
            `El producto ID ${item.id} no pertenece a marca VERCO y categoría ZAPATILLAS`,
          );
        }

        let hasChanges = false;

        for (const field of allowedPriceFields) {
          const value = item[field];

          // Si el campo no viene, NO se actualiza
          if (value === undefined || value === null) {
            continue;
          }

          const numericValue = Number(value);

          if (Number.isNaN(numericValue)) {
            throw new BadRequestException(
              `El campo ${field} del producto ID ${item.id} no es válido`,
            );
          }

          if (numericValue < 0) {
            throw new BadRequestException(
              `El campo ${field} del producto ID ${item.id} no puede ser negativo`,
            );
          }

          (product as any)[field] = numericValue;
          hasChanges = true;
        }

        if (hasChanges) {
          const savedProduct = await manager.save(Product, product);

          updatedProducts.push({
            id: savedProduct.id,
            article_code: savedProduct.article_code,
            article_description: savedProduct.article_description,
            brand_name: savedProduct.brand_name,
            category: product.category?.name,
            prices: {
              manufacturing_cost: Number(savedProduct.manufacturing_cost ?? 0),
              unit_price: Number(savedProduct.unit_price ?? 0),
              factory_price: Number(savedProduct.factory_price ?? 0),
              dropshipping_price: Number(savedProduct.dropshipping_price ?? 0),
              wholesale_price: Number(savedProduct.wholesale_price ?? 0),
            },
          });
        }
      }

      return {
        message: 'Precios actualizados correctamente',
        totalReceived: dto.products.length,
        totalUpdated: updatedProducts.length,
        productsNotFound,
        updatedProducts,
      };
    });
  }

}