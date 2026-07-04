import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class RegistrarAbonoEstadoCuentaDto {
  @IsInt()
  id_estado_cuenta: number;

  @IsNumber()
  @Min(0.01)
  monto_abono: number;

  @IsInt()
  usuario_id: number;

  @IsOptional()
  @IsString()
  metodo_pago?: string;

  @IsOptional()
  @IsString()
  numero_operacion?: string;

  @IsOptional()
  @IsDateString()
  fecha_pago?: string;

  @IsOptional()
  @IsString()
  observacion?: string;

  @IsOptional()
  @IsString()
  comprobante_url?: string;
}