import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../database/entities/categories.entity';  // Asegúrate de que la ruta sea correcta
import { CreateCategoryDto } from './dto/create-categories.dto'; // DTO para crear categorías

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}
 
  // Método para obtener todas las categorías
  async getAllCategories() {
    try {
      return await this.categoryRepository.find();
    } catch (error) {
      throw new BadRequestException('Error al obtener las categorías');
    }
  }
}
