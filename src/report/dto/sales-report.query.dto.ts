import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsISO8601, IsOptional, Min } from 'class-validator';

export class SalesReportQueryDto {
  // 1) tienda
  @Type(() => Number)
  @IsInt()
  @Min(1)
  warehouseId: number;

  // 2) tipo de reporte: DAY | RANGE
  // - DAY: usa date
  // - RANGE: usa from & to (sirve para semana o mes)
  @IsIn(['DAY', 'RANGE'])
  type: 'DAY' | 'RANGE';

  // si es DAY
  @IsOptional()
  @IsISO8601()
  date?: string; // "2025-12-28"

  // si es RANGE (semana/mes)
  @IsOptional()
  @IsISO8601()
  from?: string; // "2025-12-01"

  @IsOptional()
  @IsISO8601()
  to?: string; // "2025-12-31"

  // filtro opcional por vendedor
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId?: number;

  @IsDateString()
  @IsOptional()
  start: string; // fecha de inicio (rango de fechas, si aplica)

  @IsDateString()
  @IsOptional()
  end: string; // fecha de fin (rango de fechas, si aplica)

}
