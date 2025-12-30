// approve-order.dto.ts
import { IsInt } from 'class-validator';
export class ApproveOrderDto {
  @IsInt() approved_by: number;
}