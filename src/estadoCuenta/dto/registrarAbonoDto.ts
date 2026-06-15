import { IsNumber, IsString } from 'class-validator';

export class RegistrarAbonoDto {
  @IsNumber()
  cliente_id!: number;

  @IsNumber()
  monto_abono!: number;

  @IsString()
  tipo_abono!: string;

  @IsString()
  moneda_abono!: string;
}