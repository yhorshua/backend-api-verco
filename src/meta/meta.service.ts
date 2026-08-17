import {
    ForbiddenException,
    Injectable,
    InternalServerErrorException,
    Logger,
    ServiceUnavailableException,
    UnauthorizedException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';

import { createHmac, timingSafeEqual } from 'crypto';
import { firstValueFrom } from 'rxjs';
import { DataSource, Repository } from 'typeorm';

// Cambiar estos imports por la ubicación real de tus entidades.
import { Asesor } from '../database/entities/asesor.entity';
import { EstadoLeadEnum, Lead, OrigenLeadEnum } from '../database/entities/lead.entity';
import { Mensaje } from '../database/entities/mensaje.entity';
import { NotificacionGateway } from 'src/meta/notificacion.gateway';

interface ReferralMeta {
    source_url?: string;
    source_type?: string;
    source_id?: string;
    headline?: string;
    body?: string;
    media_type?: string;
    image_url?: string;
    video_url?: string;
    thumbnail_url?: string;
    ctwa_clid?: string;
}

interface MensajeWhatsAppNormalizado {
    phoneNumberId: string;
    nombreCliente: string;
    telefonoCliente: string;
    metaMessageId: string;
    fechaMensaje: Date;
    tipoMensaje: string;
    contenido: string;
    referral: ReferralMeta | null;
}

@Injectable()
export class MetaWebhookService {
    private readonly logger = new Logger(MetaWebhookService.name);

    constructor(
        private readonly dataSource: DataSource,
        private readonly httpService: HttpService,
        private readonly notificacionGateway:
            NotificacionGateway,

        @InjectRepository(Asesor)
        private readonly asesorRepo: Repository<Asesor>,

        @InjectRepository(Lead)
        private readonly leadRepo: Repository<Lead>,

        @InjectRepository(Mensaje)
        private readonly mensajeRepo: Repository<Mensaje>,
    ) { }

    /**
     * Paso 1:
     * Meta realiza una petición GET para verificar el webhook.
     */
    verificarWebhook(
        mode: string,
        verifyTokenRecibido: string,
        challenge: string,
    ) {
        const verifyTokenConfigurado =
            process.env.META_WEBHOOK_VERIFY_TOKEN;

        if (!verifyTokenConfigurado) {
            throw new InternalServerErrorException(
                'META_WEBHOOK_VERIFY_TOKEN no está configurado',
            );
        }

        const esValido =
            mode === 'subscribe' &&
            verifyTokenRecibido === verifyTokenConfigurado;

        if (!esValido) {
            throw new ForbiddenException(
                'No se pudo verificar el webhook de Meta',
            );
        }

        /*
         * Meta necesita recibir exactamente el challenge.
         */
        return challenge;
    }

    /**
     * Comprueba que la petición realmente fue enviada por Meta.
     *
     * Para esto necesitamos conservar el rawBody en main.ts.
     */
    validarFirma(
        rawBody: Buffer | undefined,
        signature: string | undefined,
    ) {
        const appSecret = process.env.META_APP_SECRET;

        if (!appSecret) {
            throw new InternalServerErrorException(
                'META_APP_SECRET no está configurado',
            );
        }

        if (!rawBody || !signature) {
            throw new UnauthorizedException(
                'La petición no contiene una firma válida',
            );
        }

        const firmaEsperada =
            'sha256=' +
            createHmac('sha256', appSecret)
                .update(rawBody)
                .digest('hex');

        const firmaEsperadaBuffer = Buffer.from(firmaEsperada);
        const firmaRecibidaBuffer = Buffer.from(signature);

        if (
            firmaEsperadaBuffer.length !== firmaRecibidaBuffer.length
        ) {
            throw new UnauthorizedException(
                'Firma de Meta inválida',
            );
        }

        const esValida = timingSafeEqual(
            firmaEsperadaBuffer,
            firmaRecibidaBuffer,
        );

        if (!esValida) {
            throw new UnauthorizedException(
                'Firma de Meta inválida',
            );
        }
    }

    /**
     * Procesa todo el payload recibido.
     *
     * Un webhook también puede contener solamente estados:
     * sent, delivered, read, failed.
     *
     * Por eso verificamos que exista value.messages.
     */
    async procesarWebhook(body: any) {
        if (body?.object !== 'whatsapp_business_account') {
            this.logger.warn(
                `Objeto de webhook ignorado: ${body?.object}`,
            );

            return {
                ok: true,
                procesados: 0,
            };
        }

        const mensajes = this.extraerMensajes(body);

        if (!mensajes.length) {
            /*
             * Probablemente es un webhook de estados.
             * No es un error.
             */
            return {
                ok: true,
                procesados: 0,
            };
        }

        const resultados: any[] = [];

        for (const mensaje of mensajes) {
            try {
                const resultado =
                    await this.procesarMensajeEntrante(mensaje);

                resultados.push(resultado);
            } catch (error) {
                this.logger.error(
                    `No se pudo procesar el mensaje ${mensaje.metaMessageId}`,
                    error instanceof Error ? error.stack : String(error),
                );

                /*
                 * En una versión posterior conviene enviar este trabajo
                 * a una cola como BullMQ para gestionar reintentos.
                 */
                throw error;
            }
        }

        return {
            ok: true,
            procesados: resultados.length,
            resultados,
        };
    }

    /**
     * Convierte el payload complejo de Meta en objetos simples.
     */
    private extraerMensajes(
        body: any,
    ): MensajeWhatsAppNormalizado[] {
        const resultados: MensajeWhatsAppNormalizado[] = [];

        for (const entry of body?.entry ?? []) {
            for (const change of entry?.changes ?? []) {
                if (change?.field !== 'messages') {
                    continue;
                }

                const value = change?.value;
                const phoneNumberId =
                    value?.metadata?.phone_number_id;

                if (!phoneNumberId) {
                    continue;
                }

                const contactos = new Map<string, any>();

                for (const contacto of value?.contacts ?? []) {
                    if (contacto?.wa_id) {
                        contactos.set(contacto.wa_id, contacto);
                    }
                }

                /*
                 * value.messages no estará presente cuando el webhook
                 * corresponda únicamente a un estado de entrega.
                 */
                for (const message of value?.messages ?? []) {
                    const telefonoCliente = String(
                        message?.from ?? '',
                    ).trim();

                    const contacto =
                        contactos.get(telefonoCliente);

                    if (
                        !telefonoCliente ||
                        !message?.id ||
                        !message?.timestamp
                    ) {
                        continue;
                    }

                    resultados.push({
                        phoneNumberId,

                        nombreCliente:
                            contacto?.profile?.name ??
                            'Cliente de WhatsApp',

                        telefonoCliente,

                        metaMessageId: message.id,

                        fechaMensaje: new Date(
                            Number(message.timestamp) * 1000,
                        ),

                        tipoMensaje:
                            message.type ?? 'unknown',

                        contenido:
                            this.obtenerContenidoMensaje(message),

                        /*
                         * Este objeto generalmente aparece cuando el primer
                         * mensaje procede de un anuncio Click-to-WhatsApp.
                         */
                        referral: message.referral ?? null,
                    });
                }
            }
        }

        return resultados;
    }

    /**
     * Permite reconocer diferentes tipos de mensaje.
     */
    private obtenerContenidoMensaje(message: any): string {
        switch (message?.type) {
            case 'text':
                return message?.text?.body ?? '';

            case 'button':
                return (
                    message?.button?.text ??
                    message?.button?.payload ??
                    '[Botón]'
                );

            case 'interactive':
                return (
                    message?.interactive?.button_reply?.title ??
                    message?.interactive?.list_reply?.title ??
                    '[Respuesta interactiva]'
                );

            case 'image':
                return (
                    message?.image?.caption ??
                    '[El cliente envió una imagen]'
                );

            case 'document':
                return (
                    message?.document?.filename ??
                    '[El cliente envió un documento]'
                );

            case 'audio':
                return '[El cliente envió un audio]';

            case 'video':
                return (
                    message?.video?.caption ??
                    '[El cliente envió un video]'
                );

            case 'location':
                return '[El cliente compartió una ubicación]';

            default:
                return `[Mensaje tipo: ${message?.type ?? 'desconocido'}]`;
        }
    }

    /**
     * Registra el lead y asigna al vendedor.
     */
    private async procesarMensajeEntrante(
        mensaje: MensajeWhatsAppNormalizado,
    ) {


        const resultado =
            await this.dataSource.transaction(
                async (manager) => {


                    const leadRepo =
                        manager.getRepository(Lead);


                    const asesorRepo =
                        manager.getRepository(Asesor);


                    const mensajeRepo =
                        manager.getRepository(Mensaje);



                    let lead =
                        await leadRepo.findOne({
                            where: {
                                telefono:
                                    mensaje.telefonoCliente
                            }
                        });



                    let asesor: Asesor | null = null;



                    if (lead?.asesor_id) {


                        asesor =
                            await asesorRepo.findOne({
                                where: {
                                    id:
                                        lead.asesor_id
                                }
                            });


                    }
                    else {


                        asesor =
                            await asesorRepo
                                .createQueryBuilder('asesor')


                                .setLock(
                                    'pessimistic_write'
                                )


                                .where(
                                    'asesor.activo=:activo',
                                    {
                                        activo: true
                                    }
                                )


                                .orderBy(
                                    'asesor.fecha_ultima_asignacion',
                                    'ASC'
                                )


                                .addOrderBy(
                                    'asesor.id',
                                    'ASC'
                                )


                                .getOne();



                        if (!asesor) {

                            throw new ServiceUnavailableException(
                                'No existen asesores disponibles'
                            );

                        }
                        asesor.fecha_ultima_asignacion =
                            new Date();
                        await asesorRepo.save(
                            asesor
                        );
                    }
                    if (!lead) {
                        lead = leadRepo.create({
                            nombre: mensaje.nombreCliente,
                            telefono: mensaje.telefonoCliente,
                            mensaje_inicial: mensaje.contenido,
                            meta_message_id: mensaje.metaMessageId,
                            asesor_id: asesor!.id,

                            estado: EstadoLeadEnum.NUEVO,

                            origen: mensaje.referral
                                ? OrigenLeadEnum.FACEBOOK_ADS_WHATSAPP
                                : OrigenLeadEnum.WHATSAPP_ORGANICO,
                        });
                    }
                    else {
                        lead.asesor_id =
                            asesor!.id;
                    }
                    lead =
                        await leadRepo.save(
                            lead
                        );
                    const nuevoMensaje =
                        mensajeRepo.create({

                            lead_id:
                                lead.id,
                            direccion:
                                'ENTRANTE',
                            tipo:
                                mensaje.tipoMensaje,
                            contenido:
                                mensaje.contenido,
                            meta_message_id:
                                mensaje.metaMessageId

                        });
                    await mensajeRepo.save(
                        nuevoMensaje
                    );

                    this.notificacionGateway
                        .notificarNuevoMensaje(
                            asesor!.id,
                            {
                                leadId: lead.id,
                                nombre: lead.nombre,
                                telefono: lead.telefono,
                                mensaje: mensaje.contenido,
                                tipo: mensaje.tipoMensaje,
                                fecha: mensaje.fechaMensaje
                            }
                        );
                    return {

                        lead,
                        asesor,
                        mensaje: nuevoMensaje

                    };
                }
            );
        return {
            ok: true,
            leadId:
                resultado.lead.id,
            asesorId:
                resultado.asesor!.id,
            mensajeId:
                resultado.mensaje.id
        };
    }
}