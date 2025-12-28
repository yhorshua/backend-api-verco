import { IsNumber, Min, IsOptional, IsString } from 'class-validator';

export class CloseCashDto {
  @IsNumber()
  warehouse_id: number;

  @IsNumber()
  user_id: number;

  @IsNumber()
  session_id: number;

  @IsNumber()
  @Min(0)
  closing_cash_counted: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
