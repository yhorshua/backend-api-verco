// dto/filter-websale.dto.ts
import { IsOptional, IsEnum, IsDateString } from 'class-validator';

import { WebSaleStatus } from '../../database/entities/webSale.entity';

export class FilterWebSaleDto {

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(WebSaleStatus)
  status?: WebSaleStatus;
}