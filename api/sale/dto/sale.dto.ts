import { IsInt, IsPositive, IsOptional } from 'class-validator';

export class ChangeProductDto {
  @IsInt()
  sale_id: number;

  @IsInt()
  product_id: number;

  @IsInt()
  new_product_id: number;

  @IsPositive()
  quantity: number;
}

export class ReturnProductDto {
  @IsInt()
  sale_id: number;

  @IsInt()
  product_id: number;

  @IsPositive()
  quantity: number;
}
