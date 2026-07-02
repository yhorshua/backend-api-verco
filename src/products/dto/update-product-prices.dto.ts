import {
  IsArray,
  IsNumber,
  IsOptional,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateProductPriceItemDto {
  @IsNumber()
  id!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  manufacturing_cost?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unit_price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  factory_price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  dropshipping_price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  wholesale_price?: number;

}

export class UpdateProductPricesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateProductPriceItemDto)
  products!: UpdateProductPriceItemDto[];
}