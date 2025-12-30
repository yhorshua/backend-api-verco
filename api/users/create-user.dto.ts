import { Type } from 'class-transformer';
import { IsEmail, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  full_name: string;

  @IsEmail()
  @MaxLength(120)
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(100)
  password: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  rol_id: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  warehouse_id: number;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  cellphone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  address_home?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  id_cedula?: string;
}
