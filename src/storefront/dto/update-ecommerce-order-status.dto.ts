import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { EcommerceOrderStatus } from '../../database/entities/ecommerce-order.entity';

export class UpdateEcommerceOrderStatusDto {
  @IsEnum(EcommerceOrderStatus)
  status!: EcommerceOrderStatus;
  @IsOptional() @IsString() @MaxLength(80) shipping_code?:string;
  @IsOptional() @IsBoolean() payment_received?:boolean;
  @IsOptional() @IsString() @MinLength(5) @MaxLength(255) cancellation_reason?:string;
}
