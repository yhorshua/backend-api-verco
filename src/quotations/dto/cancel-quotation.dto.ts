import { IsString, MaxLength, MinLength } from 'class-validator';

export class CancelQuotationDto {
  @IsString() @MinLength(3) @MaxLength(255)
  reason!: string;
}
