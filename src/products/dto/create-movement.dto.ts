import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateMovementDto {
  @IsNumber()
  warehouse_id: number;

  @IsNumber()
  product_id: number;

  @IsOptional()
  @IsNumber()
  product_size_id?: number;

  @IsNumber()
  quantity: number;

  @IsString()
  unit_of_measure: string;

  @IsOptional()
  @IsString()
  reference?: string; // guía interna, factura, pedido

  @IsNumber()
  user_id: number;
}