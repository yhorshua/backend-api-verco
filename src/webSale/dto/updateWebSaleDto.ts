
import { IsEnum } from 'class-validator';

import { WebSaleStatus } from '../../database/entities/webSale.entity';

export class UpdateWebSaleDto {

    @IsEnum(WebSaleStatus)
    status!: WebSaleStatus;

    shipping_code?: string;
}
