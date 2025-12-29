import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class SellersByWarehouseQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  warehouseId: number;
}
