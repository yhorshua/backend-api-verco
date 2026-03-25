import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateSaleItemDto {
  @IsNumber()
  product_id: number;

  @IsOptional()
  @IsNumber()
  product_size_id?: number;

  @IsNumber()
  @IsPositive()
  quantity: number;

  @IsString()
  unit_of_measure: string; // PAR / UND / etc.
}
