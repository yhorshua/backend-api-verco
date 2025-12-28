// src/cash/dto/open-cash.dto.ts
import { IsNumber, Min } from 'class-validator';

export class OpenCashDto {
  @IsNumber()
  warehouse_id: number;

  @IsNumber()
  user_id: number;

  @IsNumber()
  @Min(0)
  opening_cash: number;
}
