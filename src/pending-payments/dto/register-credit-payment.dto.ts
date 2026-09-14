import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class RegisterCreditPaymentDto {
  @IsString()
  @Matches(/^\d{1,8}(\.\d{1,2})?$/, {
    message: 'amount debe ser un importe positivo con máximo dos decimales',
  })
  amount: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'payment_date debe tener formato YYYY-MM-DD',
  })
  payment_date: string;

  @IsIn(['efectivo', 'yape', 'plin', 'tarjetaDebito', 'tarjetaCredito'])
  method: 'efectivo' | 'yape' | 'plin' | 'tarjetaDebito' | 'tarjetaCredito';

  @ValidateIf((dto: RegisterCreditPaymentDto) => dto.method !== 'efectivo')
  @IsString()
  @MinLength(6)
  @MaxLength(50)
  operation_number?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'next_payment_date debe tener formato YYYY-MM-DD',
  })
  next_payment_date?: string;

  @IsUUID()
  idempotency_key: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}

