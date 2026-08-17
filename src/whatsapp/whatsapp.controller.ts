import {
    Body,
    Controller,
    Post,
} from '@nestjs/common';


import { WhatsAppService } from './whatsapp.service';



@Controller('whatsapp')
export class WhatsAppController {


    constructor(
        private readonly service: WhatsAppService
    ) { }



    @Post('send')
    async enviarMensaje(

        @Body()
        body: any

    ) {

        return this.service.enviarMensaje(
            body.leadId,
            body.mensaje
        );

    }


}