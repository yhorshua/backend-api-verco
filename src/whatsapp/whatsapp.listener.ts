import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { WhatsappService } from './whatsapp.service';
import { DASHBOARD_EVENTS } from '../dashCounter/dto/dashboard-events.constants';

@Injectable()
export class WhatsappListener {

    constructor(
        private readonly whatsapp: WhatsappService,
    ) { }

    private readonly numbers = [
        '51922318565',
        '51977838796',
    ];

    @OnEvent(DASHBOARD_EVENTS.ORDER_CREATED)
    async orderCreated(payload: any) {

        const text =
            `🛒 Nuevo pedido

Proforma: ${payload.proforma}

Cliente: ${payload.customerName}`;

        await Promise.all(

            this.numbers.map(number =>

                this.whatsapp.sendMessage(number, text)

            )

        );

    }

    @OnEvent(DASHBOARD_EVENTS.WEBSALE_CREATED)
    async webSaleCreated(payload: any) {

        const text =
            `💻 Nueva venta web

Ticket: ${payload.ticket}

Cliente: ${payload.customerName}`;

        await Promise.all(

            this.numbers.map(number =>

                this.whatsapp.sendMessage(number, text)

            )

        );

    }

}