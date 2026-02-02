import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) { }


  @Get('category/:categoryId')
  async getProductsByCategory(@Param('categoryId') categoryId: number) {
    return this.productsService.findByCategory(categoryId);
  }

  @Get('warehouse/:warehouseId')
  async findByWarehouse(@Param('warehouseId') warehouseId: string) {
    return this.productsService.findByWarehouse(+warehouseId);
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
