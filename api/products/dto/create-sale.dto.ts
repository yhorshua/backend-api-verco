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
}

/**
 * ✅ Detalle de pago que tu UI genera
 * Se valida según payment_method (con ValidateIf).
 */
class PaymentDetailDto {
  // ====== EFECTIVO ======
  @ValidateIf((o: PaymentDetailDto) => o.__method === 'efectivo')
  @IsNumber()
  @Min(0)
  efectivoEntregado?: number;

  @ValidateIf((o: PaymentDetailDto) => o.__method === 'efectivo')
  @IsNumber()
  @Min(0)
  vuelto?: number;

  // ====== YAPE / PLIN / TARJETA ======
  @ValidateIf((o: PaymentDetailDto) =>
    ['yape', 'plin', 'tarjetaDebito', 'tarjetaCredito'].includes(o.__method),
  )
  @IsString()
  @IsNotEmpty()
  numeroOperacion?: string;

  // ====== MIXTO (Yape + Efectivo) ======
  @ValidateIf((o: PaymentDetailDto) => o.__method === 'yapeEfectivo')
  @IsNumber()
  @Min(0.01)
  yapeMonto?: number;

  @ValidateIf((o: PaymentDetailDto) => o.__method === 'yapeEfectivo')
  @IsString()
  @IsNotEmpty()
  yapeOperacion?: string;

  @ValidateIf((o: PaymentDetailDto) => o.__method === 'yapeEfectivo')
  @IsNumber()
  @Min(0)
  efectivoEntregadoMixto?: number;

  @ValidateIf((o: PaymentDetailDto) => o.__method === 'yapeEfectivo')
  @IsNumber()
  @Min(0)
  vueltoMixto?: number;

  // ====== OBSEQUIO ======
  @ValidateIf((o: PaymentDetailDto) => o.__method === 'obsequio')
  @IsString()
  @IsNotEmpty()
  motivoObsequio?: string;

  @ValidateIf((o: PaymentDetailDto) => o.__method === 'obsequio')
  @IsOptional()
  @IsString()
  autorizadoPor?: string;

  /**
   * ⚠️ Campo interno para que ValidateIf sepa el método.
   * No lo envías desde el frontend: lo seteamos en el service/controller
   * justo antes de validar o procesar.
   */
  __method: PaymentMethod;
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
