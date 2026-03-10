import { IsInt, IsPositive, IsOptional, IsString } from 'class-validator';

import { IsNumber } from 'class-validator';

export class ChangeProductDto {

  @IsNumber()
  sale_id: number;

  @IsNumber()
  product_id: number;

  @IsNumber()
  new_product_id: number;

  @IsNumber()
  new_product_size_id: number;

  @IsNumber()
  quantity: number;

  @IsNumber()
  old_product_price: number;

  @IsNumber()
  new_product_price: number;

}

export class ReturnProductDto {

  @IsNumber()
  sale_id: number;

  @IsNumber()
  product_id: number;

  @IsNumber()
  quantity: number;

  @IsNumber()
  price_at_return: number;

  @IsNumber()
  warehouse_id: number;

  @IsOptional()
  @IsString()
  reason?: string;

}