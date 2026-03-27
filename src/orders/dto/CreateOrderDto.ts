// src/modules/orders/dto/create-order.dto.ts
import { IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
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

  /* ============================================================
   🔥 NUEVO: TIPO DE PEDIDO
============================================================ */
  @IsOptional()
  @IsIn(['NORMAL', 'DROPSHIPPING'])
  order_type?: 'NORMAL' | 'DROPSHIPPING';

  /* ============================================================
     🔥 NUEVO: PAGO
  ============================================================ */
  @IsOptional()
  @IsIn(['PENDIENTE', 'PAGADO'])
  payment_status?: 'PENDIENTE' | 'PAGADO';

  @IsOptional()
  @IsString()
  payment_reference?: string;

  @IsOptional()
  @IsIn(['YAPE', 'PLIN', 'TRANSFERENCIA'])
  payment_method?: 'YAPE' | 'PLIN' | 'TRANSFERENCIA';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
