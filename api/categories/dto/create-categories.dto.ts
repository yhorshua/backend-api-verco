import { IsString, IsOptional } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  name: string; // Nombre de la categoría

  @IsString()
  @IsOptional() // Ahora es opcional
  description?: string; // Descripción de la categoría (opcional)
}
