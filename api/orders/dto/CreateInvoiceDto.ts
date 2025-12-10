import { IsNotEmpty, IsOptional } from "class-validator";

export class CreateInvoiceDto {
  @IsNotEmpty() ruc_emisor: string;
  @IsNotEmpty() razon_social_emisor: string;
  @IsNotEmpty() direccion_emisor: string;
  @IsNotEmpty() ruc_receptor: string;
  @IsNotEmpty() razon_social_receptor: string;
  @IsNotEmpty() direccion_receptor: string;
  @IsOptional() total_descuento?: number;
  @IsOptional() forma_pago?: string;
  @IsOptional() observaciones?: string;
}
