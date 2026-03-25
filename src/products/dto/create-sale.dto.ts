import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
  Min,
  IsNotEmpty,
} from 'class-validator';

export type PaymentMethod =
  | 'efectivo'
  | 'yape'
  | 'plin'
  | 'tarjetaDebito'
  | 'tarjetaCredito'
  | 'yapeEfectivo'
  | 'obsequio';

class CreateSaleItemDto {
  @IsNumber()
  product_id: number;

  @IsOptional()
  @IsNumber()
  product_size_id?: number;

  @IsNumber()
  quantity: number;

  @IsString()
  unit_of_measure: string;

   @IsNumber()
  unit_price: number;
}

/**
 * ✅ Detalle de pago que tu UI genera
 * Se valida según payment_method (con ValidateIf).
 */
class PaymentDetailDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  efectivoEntregado?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  vuelto?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  numeroOperacion?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  yapeMonto?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  yapeOperacion?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  efectivoEntregadoMixto?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  vueltoMixto?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  motivoObsequio?: string;

  @IsOptional()
  @IsString()
  autorizadoPor?: string;
}


export class CreateSaleDto {
  @IsNumber()
  warehouse_id: number;

  @IsNumber()
  user_id: number;

  @IsOptional()
  @IsNumber()
  customer_id?: number;

  // ✅ valida que venga uno de tus métodos
  @IsIn(['efectivo', 'yape', 'plin', 'tarjetaDebito', 'tarjetaCredito', 'yapeEfectivo', 'obsequio'])
  payment_method: PaymentMethod;

  // ✅ aquí llegarán los campos extra de tu UI
  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentDetailDto)
  payment?: PaymentDetailDto;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items: CreateSaleItemDto[];
}
