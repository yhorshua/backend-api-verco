import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateWarehouseDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  warehouse_name: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;
}
