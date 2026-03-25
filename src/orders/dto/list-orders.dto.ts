// list-orders.dto.ts
import { IsInt, IsOptional, IsString } from 'class-validator';
export class ListOrdersDto {
  @IsInt() warehouseId: number;
  @IsOptional() @IsString() status?: string; // PENDING_APPROVAL, APPROVED...
}