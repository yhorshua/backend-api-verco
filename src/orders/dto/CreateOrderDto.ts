// src/modules/orders/dto/create-order.dto.ts
import { IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderDto {
  @IsInt()
  client_id!: number;

  @IsInt()
  user_id!: number;

  @IsInt()
  warehouse_id!: number;

  @IsOptional()
  @IsString()
  observations?: string;

  @IsOptional()
  @IsIn(['NORMAL', 'DROPSHIPPING'])
  order_type?: 'NORMAL' | 'DROPSHIPPING';

  @IsOptional()
  @IsIn(['PENDIENTE', 'PAGADO'])
  payment_status?: 'PENDIENTE' | 'PAGADO';

  @IsOptional()
  @IsString()
  payment_reference?: string;

  @IsOptional()
  @IsIn(['YAPE', 'PLIN', 'TRANSFERENCIA'])
  payment_method?: 'YAPE' | 'PLIN' | 'TRANSFERENCIA';

  // 🔥 AGREGAR ESTO
  @IsOptional()
  @IsString()
  customer_name?: string;

  @IsOptional()
  @IsString()
  customer_phone?: string;

  @IsOptional()
  @IsString()
  customer_address?: string;

  @IsOptional()
  @IsString()
  customer_reference?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];
}

class CreateOrderItemDto {
  @IsInt()
  product_id!: number;

  @IsOptional()
  product_size_id?: number | null;

  @IsString()
  size!: string;

  @IsNumber()
  quantity!: number;

  @IsNumber()
  unit_price!: number;
}