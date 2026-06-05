import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, BadRequestException, UseInterceptors, UploadedFile, Req } from '@nestjs/common';
import express from 'express';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) { }


  // Endpoint para consultar por código de artículo o descripción
  @UseGuards(JwtAuthGuard)
  @Get('search')
  async searchProduct(@Query('query') query: string) {
    return await this.productsService.findByCode(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('filter')
  async getProducts(
    @Query('categoryId') categoryId: number | null = null,  // Categoria opcional
    @Query('warehouseId') warehouseId: number,       // Warehouse obligatorio
    @Query('serie') serie: string | null = null  // Categoria opcional
  ) {
    console.log('categoryId:', categoryId);  // Verifica el valor de categoryId
    console.log('warehouseId:', warehouseId); // Verifica el valor de warehouseId
    const products = await this.productsService.findByCategoryAndWarehouse(categoryId, warehouseId, serie);
    return products;
  }

  @UseGuards(JwtAuthGuard)
  @Get('sizes')
  async getProductsWithSizes() {
    return await this.productsService.findProductsWithSizes();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(+id);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    return this.productsService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Post('many')
  createMany(@Body() createProductDtos: CreateProductDto[]) {
    return this.productsService.createMany(createProductDtos);  // Llamada al servicio para crear múltiples productos
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(+id, updateProductDto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/disable')
  disable(@Param('id') id: string) {
    return this.productsService.disable(+id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async updateProduct(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto
  ) {
    return await this.productsService.update(+id, updateProductDto);
  }


  @Post('import-stock')
  @UseInterceptors(FileInterceptor('file'))
  async importStockExcel(
    @UploadedFile() file: any,
    @Req() req: express.Request,
  ) {

    if (!file) {
      throw new BadRequestException(
        'Debe adjuntar un archivo Excel',
      );
    }

    const warehouseId =
      (req.user as any).warehouseId;

    if (!warehouseId) {
      throw new BadRequestException(
        'El usuario no tiene almacén asignado',
      );
    }

    return await this.productsService.importStockExcel(
      warehouseId,
      file,
    );
  }
}
