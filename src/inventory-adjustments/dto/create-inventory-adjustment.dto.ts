import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { InventoryAdjustmentReason } from './inventory-adjustment-reason.enum';

export class InventoryAdjustmentItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  stock_id!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  product_id!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  product_size_id!: number | null;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2_000_000_000)
  observed_quantity!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2_000_000_000)
  new_quantity!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  observed_version!: number;
}

export class CreateInventoryAdjustmentDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  warehouse_id!: number;

  @IsEnum(InventoryAdjustmentReason)
  reason!: InventoryAdjustmentReason;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(500)
  observation?: string;

  @IsUUID('4')
  idempotency_key!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => InventoryAdjustmentItemDto)
  items!: InventoryAdjustmentItemDto[];
}
