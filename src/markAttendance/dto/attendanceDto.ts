export class AttendanceResponseDto {
  userId: number;
  tipo: 'entrada' | 'salida';
  ubicacion: string | null;
  fecha: string;
  hora_entrada: string | null;
  hora_salida: string | null;
}