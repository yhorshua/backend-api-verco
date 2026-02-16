import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class HasUserEnteredTodayResponseDto {
  @IsString()
  message: string;

  @IsBoolean()
  hasEntered: boolean;

  @IsOptional()
  @IsNumber()
  userId?: number; // Esto es opcional, ya que solo lo devolveremos si el usuario ha registrado su entrada

  @IsOptional()
  @IsString()
  tipo?: string; // Tipo de registro ('entrada' o 'salida')
}
