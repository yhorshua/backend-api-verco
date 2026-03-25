// close-packing.dto.ts
import { IsInt } from 'class-validator';

export class ClosePackingDto {
  @IsInt() order_id: number;
  @IsInt() user_id: number; // quien cierra packing
}
