import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateGuiaDevolucionDetalleDto {
  @IsInt()
  id_guia_interna_detalle: number;

  @IsInt()
  @Min(1)
  cantidad: number;

  @IsOptional()
  @IsString()
  motivo?: string;

  @IsOptional()
  @IsString()
  destino?: 'STOCK_DISPONIBLE' | 'CUARENTENA' | 'MERMA';

  @IsOptional()
  @IsBoolean()
  reingresa_stock?: boolean;
}

export class CreateGuiaDevolucionDto {
  @IsInt()
  id_guia_interna: number;

  @IsInt()
  usuario_id: number;

  @IsOptional()
  @IsString()
  motivo_general?: string;

  @IsOptional()
  @IsString()
  observacion?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGuiaDevolucionDetalleDto)
  items: CreateGuiaDevolucionDetalleDto[];
}