import { IsNumber, Min, IsString, IsNotEmpty } from 'class-validator';

export class ExpenseDto {
  @IsNumber()
  warehouse_id: number;

  @IsNumber()
  user_id: number;

  @IsNumber()
  session_id: number;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @IsNotEmpty()
  description: string;
}
