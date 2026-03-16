import { IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class ChangeProductDto {

  @Type(() => Number)
  @IsNumber()
  sale_id: number;

  @Type(() => Number)
  @IsNumber()
  product_id: number;

  @Type(() => Number)
  @IsNumber()
  new_product_id: number;

  @Type(() => Number)
  @IsNumber()
  new_product_size_id: number;

  @Type(() => Number)
  @IsNumber()
  quantity: number;

  @Type(() => Number)
  @IsNumber()
  old_product_price: number;

  @Type(() => Number)
  @IsNumber()
  old_product_size_id: number;

  @Type(() => Number)
  @IsNumber()
  new_product_price: number;

}

export class ReturnProductDto {

  @Type(() => Number)
  @IsNumber()
  sale_id: number;

  @Type(() => Number)
  @IsNumber()
  product_id: number;

  @Type(() => Number)
  @IsNumber()
  quantity: number;

  @Type(() => Number)
  @IsNumber()
  price_at_return: number;

  @Type(() => Number)
  @IsNumber()
  warehouse_id: number;

  @IsOptional()
  @IsString()
  reason?: string;

}