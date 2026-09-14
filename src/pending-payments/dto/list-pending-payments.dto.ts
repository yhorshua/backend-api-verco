import { Type } from 'class-transformer';
import {
  IsIn,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ListPendingPaymentsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsIn(['all', 'pending', 'due_today', 'overdue', 'paid'])
  status: 'all' | 'pending' | 'due_today' | 'overdue' | 'paid' = 'all';

  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  warehouseId?: number;

  @IsOptional()
  @IsIn(['sale_code', 'sale_date', 'customer', 'total_amount', 'amount_paid', 'monto_restante', 'fecha_proximo_pago', 'status'])
  sortBy:
    | 'sale_code'
    | 'sale_date'
    | 'customer'
    | 'total_amount'
    | 'amount_paid'
    | 'monto_restante'
    | 'fecha_proximo_pago'
    | 'status' = 'fecha_proximo_pago';

  @IsOptional()
  @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  sortDir: 'ASC' | 'DESC' | 'asc' | 'desc' = 'ASC';
}
