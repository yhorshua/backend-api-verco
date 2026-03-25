// dto/create-client.dto.ts
import { IsString, IsOptional, IsEmail, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateClientDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(10)
  document_type_code: string; // ✅ ej "06" RUC, "01" DNI

  @IsNotEmpty()
  @IsString()
  @MaxLength(20)
  document_number: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  business_name: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  trade_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  address?: string;

  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() province?: string;
  @IsOptional() @IsString() department?: string;

  @IsOptional() @IsString() country?: string;

  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
}
