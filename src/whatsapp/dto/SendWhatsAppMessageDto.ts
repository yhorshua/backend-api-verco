import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class SendWhatsAppMessageDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  leadId!: number;

  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  mensaje!: string;
}
