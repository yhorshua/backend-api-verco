import {
    Body,
    Controller,
    Get,
    Headers,
    HttpCode,
    HttpStatus,
    Post,
    Query,
    Req,
} from '@nestjs/common';

import type {
    RawBodyRequest,
} from '@nestjs/common';

import { Request } from 'express';

import { MetaWebhookService } from './meta.service';


@Controller('webhook/meta')
export class MetaWebhookController {


    constructor(
        private readonly service: MetaWebhookService,
    ) {}



    @Get('whatsapp')
    verificarWebhook(

        @Query('hub.mode')
        mode:string,

        @Query('hub.verify_token')
        verifyToken:string,

        @Query('hub.challenge')
        challenge:string,

    ){

        return this.service.verificarWebhook(
            mode,
            verifyToken,
            challenge
        );

    }



    @Post('whatsapp')
    @HttpCode(HttpStatus.OK)
    async recibirWebhook(

        @Req()
        request:RawBodyRequest<Request>,


        @Headers('x-hub-signature-256')
        signature:string,


        @Body()
        body:any,

    ){


        this.service.validarFirma(
            request.rawBody,
            signature
        );



        const resultado =
            await this.service.procesarWebhook(
                body
            );



        return {

            ok:true,

            message:
            'EVENT_RECEIVED',

            resultado

        };


    }


}