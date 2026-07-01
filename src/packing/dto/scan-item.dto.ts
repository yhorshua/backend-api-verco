import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class ScanItemBulkRowDto {
  @IsString()
  @IsNotEmpty()
  codigo_producto!: string;

  @IsString()
  @IsNotEmpty()
  talla!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  cantidad!: number;
}

export class ScanItemsBulkDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  order_id!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScanItemBulkRowDto)
  items!: ScanItemBulkRowDto[];
}