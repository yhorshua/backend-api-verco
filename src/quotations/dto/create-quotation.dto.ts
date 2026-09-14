import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsOptional, IsString, IsUUID, Matches, MaxLength, Min } from 'class-validator';

const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class CreateQuotationItemDto {
  @Type(() => Number) @IsInt() @Min(1) product_id!: number;
  @Type(() => Number) @IsInt() @Min(1) product_size_id!: number;
  @Type(() => Number) @IsInt() @Min(1) quantity!: number;
  @IsString() @Matches(MONEY_PATTERN) unit_price!: string;
  @IsOptional() @IsString() @Matches(MONEY_PATTERN) discount_amount?: string;
  @IsOptional() @IsString() @Matches(MONEY_PATTERN) tax_amount?: string;
}

export class CreateQuotationDto {
  @Type(() => Number) @IsInt() @Min(1) client_id!: number;
  @Type(() => Number) @IsInt() @Min(1) seller_id!: number;
  @Type(() => Number) @IsInt() @Min(1) warehouse_id!: number;
  @IsUUID('4') idempotency_key!: string;
  @IsOptional() @IsString() @Matches(DATE_PATTERN) expires_on?: string;
  @IsOptional() @IsString() @MaxLength(500) observations?: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200)
  @Type(() => CreateQuotationItemDto)
  items!: CreateQuotationItemDto[];
}
