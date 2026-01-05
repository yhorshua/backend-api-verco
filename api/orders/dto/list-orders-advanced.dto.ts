import { IsOptional } from 'class-validator';

export class ListOrdersAdvancedDto {
  @IsOptional()
  user_id?: number;

  @IsOptional()
  role?: string;

  @IsOptional()
  client_id?: number;

  @IsOptional()
  seller_id?: number;

  @IsOptional()
  status?: number;

  @IsOptional()
  date_from?: string;

  @IsOptional()
  date_to?: string;
}
