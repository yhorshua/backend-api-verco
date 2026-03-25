import { Type } from "class-transformer";
import { IsInt } from "class-validator";

export class AttendanceResponseDto {
  
  @Type(() => Number)
  @IsInt()
  userId: number;
  tipo: 'entrada' | 'salida';
  ubicacion: string | null;
  fecha: string;
  hora_entrada: string | null;
  hora_salida: string | null;
}