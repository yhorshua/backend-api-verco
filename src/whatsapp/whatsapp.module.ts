import { Module } from '@nestjs/common';

import { HttpModule } from '@nestjs/axios';

import { WhatsAppController } from './whatsapp.controller';

import { WhatsAppService } from './whatsapp.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lead } from 'src/database/entities/lead.entity';
import { Mensaje } from 'src/database/entities/mensaje.entity';



@Module({
    imports: [
        HttpModule,
        TypeOrmModule.forFeature([
            Lead,
            Mensaje,
        ]),
    ],
    providers: [
        WhatsAppService,
    ],
    exports: [
        WhatsAppService,
    ],
})
export class WhatsAppModule { }