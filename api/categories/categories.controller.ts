import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-categories.dto';
import { JwtAuthGuard } from 'api/auth/jwt-auth.guard';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}
  
  // Obtener todas las categorías
  @UseGuards(JwtAuthGuard)
  @Get()
  async getAllCategories() {
    return this.categoriesService.getAllCategories();
  }
}
