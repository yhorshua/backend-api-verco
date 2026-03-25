// src/modules/orders/dto/create-order.dto.ts
import { IsArray, IsInt, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class CreateOrderItemDto {
  @IsInt() product_id: number;
  @IsOptional() product_size_id?: number | null;
  @IsString() size: string;

  @IsNumber() quantity: number;
  @IsNumber() unit_price: number;
}

export class CreateOrderDto {
  @IsInt() client_id: number;
  @IsInt() user_id: number; // vendedor
  @IsInt() warehouse_id: number;

  @IsOptional() @IsString() observations?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
