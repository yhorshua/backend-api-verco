import { Module } from '@nestjs/common';

import { WhatsappService } from './whatsapp.service';
import { WhatsappListener } from './whatsapp.listener';

@Module({

    providers:[
        WhatsappService,
        WhatsappListener
    ],

    exports:[
        WhatsappService
    ]

})
export class WhatsappModule{}