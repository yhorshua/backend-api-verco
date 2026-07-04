import { IsDateString, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { TipoCreditoEnum } from '../../database/entities/estado-cuenta.entity';

export class CreateGuiaInternaDto {
  @IsInt()
  order_id!: number;

  @IsInt()
  usuario_id!: number;

  @IsEnum(TipoCreditoEnum)
  tipo_credito!: TipoCreditoEnum;

  @IsOptional()
  @IsDateString()
  fecha_vencimiento?: string;

  @IsOptional()
  @IsInt()
  dias_credito?: number;

  @IsOptional()
  @IsString()
  observaciones?: string;
}