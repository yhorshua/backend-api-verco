import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from '../database/entities/categories.entity'; // Asegúrate de importar la entidad correctamente

@Module({
  imports: [TypeOrmModule.forFeature([Category])], // Esto importa la entidad de la categoría
  controllers: [CategoriesController], // Incluye el controlador
  providers: [CategoriesService], // Incluye el servicio
})
export class CategoriesModule {}
