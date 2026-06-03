import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

import { Type } from 'class-transformer';

import { CreateWebSaleDetailDto } from './createWebSaleDetailDto';

export class CreateWebSaleDto {

  @IsString()
  @IsNotEmpty()
  customer_name!: string;

  @IsString()
  @IsNotEmpty()
  customer_dni!: string;

  @IsString()
  @IsOptional()
  customer_phone!: string;

  @IsString()
  @IsOptional()
  customer_address!: string;

  @IsString()
  department!: string;

  @IsString()
  province!: string;

  @IsString()
  district!: string;

  @IsString()
  @IsOptional()
  reference!: string;

  @IsString()
  payment_method!: string;

  @IsString()
  @IsOptional()
  observations!: string;

  @IsNumber()
  total_amount!: number;

  @IsNumber()
  user_id!: number;

  is_agency_delivery?: boolean;

  agency_name?: string;

  shipping_code?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWebSaleDetailDto)
  details!: CreateWebSaleDetailDto[];
}