import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsInt, IsNotEmpty, IsNumberString, IsOptional, IsString, IsUrl, MaxLength, Min, ValidateNested } from 'class-validator';

class SoominProductSizeDto {
  @IsString() @IsNotEmpty() @MaxLength(30)
  size!: string;

  @Type(() => Number) @IsInt() @Min(0)
  stock!: number;
}

class SoominProductImageDto {
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(500)
  url!: string;
}

export class CreateSoominProductDto {
  @IsString() @IsNotEmpty() @MaxLength(80) article_code!: string;
  @IsString() @IsNotEmpty() @MaxLength(150) name!: string;
  @Type(() => Number) @IsInt() @Min(1) category_id!: number;
  @IsString() @IsNotEmpty() @MaxLength(30) article_series!: string;
  @IsString() @IsNotEmpty() @MaxLength(50) group_code!: string;
  @IsString() @IsNotEmpty() @MaxLength(20) color_code!: string;
  @IsString() @IsNotEmpty() @MaxLength(80) color!: string;
  @IsNumberString() selling_price!: string;
  @IsNumberString() purchase_price!: string;
  @IsOptional() @IsNumberString() original_price?: string;
  @IsOptional() @IsNumberString() shipping_cost?: string;
  @IsOptional() @IsString() @MaxLength(255) short_description?: string;
  @IsOptional() @IsString() full_description?: string;
  @IsOptional() @IsString() @MaxLength(20) gender?: string;
  @IsOptional() @IsString() @MaxLength(80) brand_name?: string;
  @IsOptional() @IsBoolean() is_new?: boolean;
  @IsOptional() @IsBoolean() is_featured?: boolean;
  @IsOptional() @IsBoolean() publish?: boolean;

  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30)
  @ValidateNested({ each: true }) @Type(() => SoominProductSizeDto)
  sizes!: SoominProductSizeDto[];

  @IsOptional() @IsArray() @ArrayMaxSize(12)
  @ValidateNested({ each: true }) @Type(() => SoominProductImageDto)
  images?: SoominProductImageDto[];
}
