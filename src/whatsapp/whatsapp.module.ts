import { Module } from '@nestjs/common';

import { HttpModule } from '@nestjs/axios';

import { WhatsAppController } from './whatsapp.controller';

import { WhatsAppService } from './whatsapp.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lead } from 'src/database/entities/lead.entity';
import { Mensaje } from 'src/database/entities/mensaje.entity';
import { Asesor } from 'src/database/entities/asesor.entity';
import { LeadHistory } from 'src/database/entities/lead-history.entity';
import { RolesGuard } from '../auth/roles.guard';



@Module({
    imports: [
        HttpModule.register({
            timeout: 10000,
            maxRedirects: 3,
        }),

        TypeOrmModule.forFeature([
            Lead,
            Mensaje,
            Asesor,
            LeadHistory,
        ]),
    ],

    controllers: [
        WhatsAppController,
    ],

    providers: [
        WhatsAppService,
        RolesGuard,
    ],

    exports: [
        WhatsAppService,
    ],
})
export class WhatsAppModule { }
