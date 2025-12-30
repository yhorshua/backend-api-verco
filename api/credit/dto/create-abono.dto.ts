// create-abono.dto.ts
import { IsIn, IsInt, IsNumber, IsString } from 'class-validator';

export class CreateAbonoDto {
  @IsInt() id_estado_cuenta: number;
  @IsInt() cliente_id: number;
  @IsNumber() monto_abono: number;

  @IsIn(['efectivo', 'deposito', 'letra', 'descuento'])
  tipo_abono: 'efectivo' | 'deposito' | 'letra' | 'descuento';

  @IsString() moneda_abono: string; // PEN | USD
  @IsInt() usuario_id: number;
}
