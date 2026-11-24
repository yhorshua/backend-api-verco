import {IsNotEmpty,IsString,MaxLength} from 'class-validator';
export class RespondEcommerceClaimDto {
 @IsString() @IsNotEmpty() @MaxLength(4000) provider_actions!:string;
 @IsString() @IsNotEmpty() @MaxLength(4000) provider_response!:string;
}
