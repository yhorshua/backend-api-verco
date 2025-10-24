import { IsString, IsOptional, IsEmail, IsNotEmpty } from 'class-validator';

export class CreateClientDto {
  @IsNotEmpty()
  document_type: string;

  @IsNotEmpty()
  document_number: string;

  @IsNotEmpty()
  business_name: string;

  @IsOptional()
  trade_name?: string;

  @IsOptional()
  address?: string;

  @IsOptional()
  district?: string;

  @IsOptional()
  province?: string;

  @IsOptional()
  department?: string;

  @IsOptional()
  country?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  phone?: string;
}
