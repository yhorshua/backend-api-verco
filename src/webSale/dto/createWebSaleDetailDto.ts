import {
  IsNumber,
  IsString,
} from 'class-validator';

export class CreateWebSaleDetailDto {

  @IsNumber()
  product_id!: number;

  @IsNumber()
  product_size_id!: number;

  @IsString()
  size!: string;

  @IsNumber()
  quantity!: number;

  @IsNumber()
  sale_price!: number;

  @IsNumber()
  subtotal!: number;
}