import { IsInt, IsOptional, IsString } from 'class-validator';
export class RejectOrderDto {
  @IsInt() rejected_by: number;
  @IsOptional() @IsString() reason?: string;
}