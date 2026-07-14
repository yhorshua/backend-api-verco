import {
  IsDateString,
  IsInt,
  Min,
} from 'class-validator';

import { Type } from 'class-transformer';

export class StockMovementReportDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  warehouseId!: number;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}