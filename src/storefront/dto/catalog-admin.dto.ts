import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class UpdateEcommerceProductDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  warehouse_id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  ecommerce_group_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  color_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  ecommerce_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  short_description?: string;

  @IsOptional()
  @IsString()
  full_description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  gender?: string | null;

  @IsOptional()
  @IsNumberString()
  selling_price?: string;

  @IsOptional()
  @IsNumberString()
  original_price?: string | null;

  @IsOptional()
  @IsNumberString()
  shipping_cost?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  discount_percent?: number;

  @IsOptional()
  @IsBoolean()
  is_new?: boolean;

  @IsOptional()
  @IsBoolean()
  is_featured?: boolean;

  @IsOptional()
  @IsBoolean()
  is_published?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  seo_title?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  seo_description?: string | null;
}

export class CreateProductImageDto {
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(500)
  image_url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  alt_text?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sort_order?: number;

  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;
}

export class RegisterProductImagesDto {
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => CreateProductImageDto)
  images!: CreateProductImageDto[];

  @IsOptional()
  @IsBoolean()
  replace_existing?: boolean;
}
