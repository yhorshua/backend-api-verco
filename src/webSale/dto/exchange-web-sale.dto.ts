import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class ExchangeWebSaleDto {
  @IsInt()
  detail_id!: number;

  @IsInt()
  new_product_id!: number;

  @IsInt()
  new_product_size_id!: number;

  @IsOptional()
  @IsString()
  new_size?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsNumber()
  @Min(0)
  new_sale_price!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}