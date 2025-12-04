import { IsNotEmpty, IsOptional } from "class-validator";

export class CreateOrderDto {
  @IsNotEmpty() proforma_number: number;
  @IsNotEmpty() client_id: number;
  @IsNotEmpty() warehouse_id: number;
  @IsOptional() observations?: string;

  @IsNotEmpty() details: {
    product_id: number;
    product_size_id?: number;
    size: string;
    quantity: number;
    unit_price: number;
  }[];
}
