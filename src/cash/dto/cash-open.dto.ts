import { IsNumber, Min, IsOptional, IsString } from 'class-validator';

export class OpenCashDto {
  @IsNumber()
  warehouse_id: number;

  @IsNumber()
  user_id: number;

  @IsNumber()
  @Min(0)
  opening_amount: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
