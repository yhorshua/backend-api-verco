import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) { }

  
  // Endpoint para consultar por código de artículo o descripción
  @Get('search')
  async searchProduct(@Query('query') query: string) {
    return await this.productsService.findByCode(query);
  }


  @Get('filter')
  async getProducts(
    @Query('categoryId') categoryId: number | null = null,  // Categoria opcional
    @Query('warehouseId') warehouseId: number       // Warehouse obligatorio
  ) {
    console.log('categoryId:', categoryId);  // Verifica el valor de categoryId
    console.log('warehouseId:', warehouseId); // Verifica el valor de warehouseId
    const products = await this.productsService.findByCategoryAndWarehouse(categoryId, warehouseId);
    return products;
  }

  @Get('sizes')
  async getProductsWithSizes() {
    return await this.productsService.findProductsWithSizes();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(+id);
  }

  @Get()
  findAll() {
    return this.productsService.findAll();
  }

  @Post('many')
  createMany(@Body() createProductDtos: CreateProductDto[]) {
    return this.productsService.createMany(createProductDtos);  // Llamada al servicio para crear múltiples productos
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(+id, updateProductDto);
  }

  @Patch(':id/disable')
  disable(@Param('id') id: string) {
    return this.productsService.disable(+id);
  }


}
