// create-guia-interna.dto.ts
import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateGuiaInternaDto {
  @IsInt() order_id: number;
  @IsInt() usuario_id: number;
  @IsOptional() @IsString() observaciones?: string;
}
