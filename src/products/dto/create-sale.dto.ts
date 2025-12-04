import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateSaleDto {
  @IsNumber()
  warehouse_id: number;

  @IsNumber()
  user_id: number; // vendedor

  @IsOptional()
  @IsNumber()
  customer_id?: number;

  @IsString()
  payment_method: string; // EFECTIVO, YAPE, TRANSFERENCIA, TARJETA

  @IsNumber()
  product_id: number;

  @IsOptional()
  @IsNumber()
  product_size_id?: number;

  @IsNumber()
  quantity: number;

  @IsString()
  unit_of_measure: string;
}