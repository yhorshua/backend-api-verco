import { IsEnum,IsOptional,IsString,MaxLength } from 'class-validator';
import { EcommerceOrderStatus } from '../../database/entities/ecommerce-order.entity';

export class UpdateEcommerceOrderStatusDto {
  @IsEnum(EcommerceOrderStatus)
  status!: EcommerceOrderStatus;
  @IsOptional() @IsString() @MaxLength(80) shipping_code?:string;
  @IsOptional() payment_received?:boolean;
}
