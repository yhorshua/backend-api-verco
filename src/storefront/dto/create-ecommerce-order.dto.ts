import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class EcommerceOrderItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  product_id!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  product_size_id!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateEcommerceOrderDto {
  @IsUUID('4')
  idempotency_key!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  customer_name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  customer_document!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  customer_phone!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  customer_address!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  department!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  province!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  district!: string;
  @IsString() @IsNotEmpty() @MaxLength(6) department_code!:string;
  @IsString() @IsNotEmpty() @MaxLength(6) province_code!:string;
  @IsString() @IsNotEmpty() @MaxLength(6) district_code!:string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reference?: string;

  @IsString()
  @IsIn(['yape', 'plin', 'contra_entrega'])
  payment_method!: string;

  @IsIn(['DOMICILIO_LIMA','AGENCIA_SHALOM']) delivery_type!:'DOMICILIO_LIMA'|'AGENCIA_SHALOM';
  @IsOptional() @IsString() @MaxLength(40) shalom_agency_id?:string;
  @IsOptional() @IsString() @MaxLength(180) shalom_agency_name?:string;
  // Se acepta temporalmente para clientes antiguos, pero ya no es obligatorio ni se persiste.
  @IsOptional() @IsString() @MaxLength(500) shalom_agency_address?:string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observations?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => EcommerceOrderItemDto)
  items!: EcommerceOrderItemDto[];
}
