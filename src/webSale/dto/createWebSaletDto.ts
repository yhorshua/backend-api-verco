import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsEnum,
  IsString,
  ValidateNested,
} from 'class-validator';

import { Type } from 'class-transformer';

import { CreateWebSaleDetailDto } from './createWebSaleDetailDto';

export enum WebSaleTypeDto {
  UNIT = 'UNIDAD',
  WHOLESALE = 'MAYOR',
}

export class CreateWebSaleDto {

  @IsOptional()
  @IsEnum(WebSaleTypeDto)
  sale_type?: WebSaleTypeDto;

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

  @IsOptional()
  @IsBoolean()
  is_agency_delivery?: boolean;

  @IsOptional()
  @IsString()
  agency_name?: string;

  @IsOptional()
  @IsString()
  shipping_code?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWebSaleDetailDto)
  details!: CreateWebSaleDetailDto[];
}
