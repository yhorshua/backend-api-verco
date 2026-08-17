import { Module } from '@nestjs/common';

import { HttpModule } from '@nestjs/axios';

import { WhatsAppController } from './whatsapp.controller';

import { WhatsAppService } from './whatsapp.service';



@Module({

imports:[
    HttpModule
],


controllers:[
    WhatsAppController
],


providers:[
    WhatsAppService
],


exports:[
    WhatsAppService
]

})
export class WhatsAppModule{}