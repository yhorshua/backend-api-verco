// create-guia-interna.dto.ts
import { IsDateString, IsInt, IsOptional, IsString } from 'class-validator';

import { TipoCreditoEnum } from '../../database/entities/estado-cuenta.entity';

export class CreateGuiaInternaDto {
  
  @IsInt() order_id!: number;
  @IsInt() usuario_id!: number;
  @IsOptional() @IsString() observaciones?: string;
  @IsString() tipo_credito!: TipoCreditoEnum;

  @IsOptional() @IsDateString() fecha_vencimiento?: string;
}
