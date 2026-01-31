import { Controller, Post, Body, Get } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-categories.dto';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}
  
  // Obtener todas las categorías
  @Get()
  async getAllCategories() {
    return this.categoriesService.getAllCategories();
  }
}
