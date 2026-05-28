
import { IsEnum } from 'class-validator';

import { WebSaleStatus } from '../../database/entities/webSale.entity';

export class UpdateWebSaleStatusDto {

    @IsEnum(WebSaleStatus)
    status!: WebSaleStatus;
}
