import { IsEnum, IsNumber } from "class-validator";
import { DetailStatus } from "src/database/entities/webDetail.entity";

export class UpdateSaleDetailStatusDto {

  @IsNumber()
  detail_id!: number;

  @IsEnum(DetailStatus)
  status!: DetailStatus;

}