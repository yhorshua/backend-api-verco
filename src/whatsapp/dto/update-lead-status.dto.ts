import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { EstadoLeadEnum } from '../../database/entities/lead.entity';

const trimOptional = ({ value }: { value: unknown }) => {
  if (value === null || value === undefined) return undefined;
  const normalized = String(value).trim();
  return normalized || undefined;
};

export class UpdateLeadStatusDto {
  @IsEnum(EstadoLeadEnum)
  estado!: EstadoLeadEnum;

  @IsOptional()
  @Transform(trimOptional)
  @IsString()
  @MaxLength(500)
  observacion?: string;

  @IsOptional()
  @Transform(trimOptional)
  @IsString()
  @MaxLength(255)
  proximaAccion?: string;

  @IsOptional()
  @IsDateString()
  fechaProximoSeguimiento?: string;
}
