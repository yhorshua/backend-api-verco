import { IsString, MaxLength, MinLength } from 'class-validator';
export class RejectOrderDto {
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  reason!: string;
}
