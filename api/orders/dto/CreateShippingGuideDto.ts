import { IsNotEmpty, IsOptional } from "class-validator";

export class CreateShippingGuideDto {
  @IsNotEmpty() motivo_traslado: string;
  @IsOptional() placa_vehiculo?: string;
  @IsOptional() nombre_transportista?: string;
  @IsOptional() observaciones?: string;
}
