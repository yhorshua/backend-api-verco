import {IsBoolean,IsEmail,IsOptional,IsString,MaxLength,MinLength} from 'class-validator';
export class GoogleCustomerLoginDto{
 @IsString() @MinLength(100) @MaxLength(5000) credential!:string;
 @IsBoolean() privacy_accepted!:boolean;
 @IsOptional() @IsBoolean() marketing_consent?:boolean;
}
export class UpdateCustomerProfileDto{
 @IsOptional() @IsString() @MaxLength(180) full_name?:string;
 @IsOptional() @IsString() @MaxLength(30) phone?:string;
 @IsOptional() @IsString() @MaxLength(10) document_type?:string;
 @IsOptional() @IsString() @MaxLength(20) document_number?:string;
 @IsOptional() @IsString() @MaxLength(255) address?:string;
 @IsOptional() @IsString() @MaxLength(100) department?:string;
 @IsOptional() @IsString() @MaxLength(6) department_code?:string;
 @IsOptional() @IsString() @MaxLength(100) province?:string;
 @IsOptional() @IsString() @MaxLength(6) province_code?:string;
 @IsOptional() @IsString() @MaxLength(100) district?:string;
 @IsOptional() @IsString() @MaxLength(6) district_code?:string;
 @IsOptional() @IsBoolean() marketing_consent?:boolean;
}
