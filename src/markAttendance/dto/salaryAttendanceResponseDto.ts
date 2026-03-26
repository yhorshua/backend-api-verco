export interface SalaryDetailDto {
  fecha: string;          // Día trabajado
  hora_entrada: string | null;
  hora_salida: string | null;
  horas_trabajadas: number;
  salario_por_dia: number;
  tardanza_minutos: number;
  horas_extras: number;
  horas_esperadas: number;
}

export interface SalaryReportDto {
  userId: number;
  month: number;
  year: number;
  totalHoras: number;
  totalSalario: number;
  detalles: SalaryDetailDto[];
}