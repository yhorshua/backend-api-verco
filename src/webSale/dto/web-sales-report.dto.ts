// web-sales-report.dto.ts
import { IsOptional, IsDateString, IsNumberString } from 'class-validator';

export class WebSalesReportFiltersDto {
  @IsOptional()
  @IsDateString({ strict: true }, { message: 'startDate debe ser una fecha válida (YYYY-MM-DD)' })
  startDate?: string;

  @IsOptional()
  @IsDateString({ strict: true }, { message: 'endDate debe ser una fecha válida (YYYY-MM-DD)' })
  endDate?: string;

  @IsOptional()
  @IsNumberString({}, { message: 'userId debe ser un número válido' })
  userId?: string;
}