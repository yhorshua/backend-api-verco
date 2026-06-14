import { IsDateString, IsOptional } from "class-validator";

export class EstadoCuentaFiltroDto {
  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;
}