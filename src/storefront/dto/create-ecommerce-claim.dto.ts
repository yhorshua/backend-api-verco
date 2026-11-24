import {IsBoolean,IsEmail,IsIn,IsNotEmpty,IsNumberString,IsOptional,IsString,MaxLength,MinLength,ValidateIf} from 'class-validator';
export class CreateEcommerceClaimDto {
 @IsIn(['RECLAMO','QUEJA']) claim_type!:'RECLAMO'|'QUEJA';
 @IsString() @IsNotEmpty() @MaxLength(150) consumer_name!:string;
 @IsIn(['DNI','CE','RUC','PASAPORTE']) document_type!:string;
 @IsString() @MinLength(6) @MaxLength(20) document_number!:string;
 @IsString() @IsNotEmpty() @MaxLength(255) consumer_address!:string;
 @IsString() @MinLength(7) @MaxLength(30) consumer_phone!:string;
 @IsEmail() @MaxLength(150) consumer_email!:string;
 @IsBoolean() is_minor!:boolean;
 @ValidateIf(o=>o.is_minor===true) @IsString() @IsNotEmpty() @MaxLength(150) representative_name?:string;
 @ValidateIf(o=>o.is_minor===true) @IsString() @MinLength(6) @MaxLength(20) representative_document?:string;
 @IsIn(['PRODUCTO','SERVICIO']) item_type!:'PRODUCTO'|'SERVICIO';
 @IsString() @MinLength(3) @MaxLength(500) item_description!:string;
 @IsNumberString() amount!:string;
 @IsOptional() @IsString() @MaxLength(30) order_code?:string;
 @IsString() @MinLength(10) @MaxLength(4000) detail!:string;
 @IsString() @MinLength(3) @MaxLength(2000) consumer_request!:string;
 @IsIn(['EMAIL','DOMICILIO']) response_method!:'EMAIL'|'DOMICILIO';
}
