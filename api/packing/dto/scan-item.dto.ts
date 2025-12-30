// scan-item.dto.ts
import { IsInt, IsString } from 'class-validator';

export class ScanItemDto {
  @IsInt() order_id: number;
  @IsString() codigo_producto: string;
  @IsString() talla: string;
  @IsInt() cantidad: number;
}
