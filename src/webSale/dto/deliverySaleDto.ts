import { IsArray } from "class-validator";
import { UpdateSaleDetailStatusDto } from "./updateSaleDetailStatusDto";

export class DeliverSaleDto {

  @IsArray()
  details!: UpdateSaleDetailStatusDto[];

}