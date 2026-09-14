import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { DataSource, IsNull } from 'typeorm';

import { Asesor } from '../database/entities/asesor.entity';
import {
  EstadoLeadEnum,
  Lead,
  OrigenLeadEnum,
} from '../database/entities/lead.entity';
import {
  DireccionMensajeEnum,
  EstadoMensajeEnum,
  Mensaje,
} from '../database/entities/mensaje.entity';
import { NotificacionGateway } from './notificacion.gateway';

interface ReferralMeta {
  source_url?: string;
  source_id?: string;
  headline?: string;
  ctwa_clid?: string;
}

interface IncomingMessage {
  phoneNumberId: string;
  nombreCliente: string;
  telefonoCliente: string;
  metaMessageId: string;
  fechaMensaje: Date;
  tipoMensaje: string;
  contenido: string;
  referral: ReferralMeta | null;
}

interface MessageStatusUpdate {
  metaMessageId: string;
  estado: EstadoMensajeEnum;
  fecha: Date;
  error: string | null;
}

@Injectable()
export class MetaWebhookService {
  private readonly logger = new Logger(MetaWebhookService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly notificacionGateway: NotificacionGateway,
  ) {}

  verificarWebhook(mode: string, receivedToken: string, challenge: string) {
    const configuredToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
    if (!configuredToken) {
      throw new InternalServerErrorException(
        'META_WEBHOOK_VERIFY_TOKEN no está configurado',
      );
    }
    if (mode !== 'subscribe' || receivedToken !== configuredToken) {
      throw new ForbiddenException('No se pudo verificar el webhook de Meta');
    }
    return challenge;
  }

  validarFirma(rawBody: Buffer | undefined, signature: string | undefined) {
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

    const expected = Buffer.from(
      `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`,
    );
    const received = Buffer.from(signature);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
      throw new UnauthorizedException('Firma de Meta inválida');
    }
  }

  async procesarWebhook(body: any) {
    if (body?.object !== 'whatsapp_business_account') {
      this.logger.warn(`Objeto de webhook ignorado: ${body?.object}`);
      return { ok: true, mensajesProcesados: 0, estadosProcesados: 0 };
    }

    const messages = this.extraerMensajes(body);
    const statuses = this.extraerEstados(body);
    const messageResults: Array<Record<string, unknown>> = [];
    const statusResults: Array<Record<string, unknown> | null> = [];

    for (const message of messages) {
      messageResults.push(await this.procesarMensajeEntrante(message));
    }
    for (const status of statuses) {
      statusResults.push(await this.procesarEstadoMensaje(status));
    }

    return {
      ok: true,
      mensajesProcesados: messageResults.length,
      estadosProcesados: statusResults.filter(Boolean).length,
      mensajes: messageResults,
    };
  }

  private extraerMensajes(body: any): IncomingMessage[] {
    const result: IncomingMessage[] = [];
    for (const entry of body?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        if (change?.field !== 'messages') continue;
        const value = change?.value;
        const phoneNumberId = String(value?.metadata?.phone_number_id ?? '').trim();
        if (!phoneNumberId) continue;

        const contacts = new Map<string, any>();
        for (const contact of value?.contacts ?? []) {
          if (contact?.wa_id) contacts.set(String(contact.wa_id), contact);
        }

        for (const message of value?.messages ?? []) {
          const phone = String(message?.from ?? '').trim();
          const timestamp = Number(message?.timestamp);
          if (!phone || !message?.id || !Number.isFinite(timestamp)) continue;
          const contact = contacts.get(phone);
          result.push({
            phoneNumberId,
            nombreCliente: String(
              contact?.profile?.name ?? 'Cliente de WhatsApp',
            ).slice(0, 100),
            telefonoCliente: phone.slice(0, 20),
            metaMessageId: String(message.id),
            fechaMensaje: new Date(timestamp * 1000),
            tipoMensaje: String(message.type ?? 'unknown').slice(0, 30),
            contenido: this.obtenerContenidoMensaje(message),
            referral: message.referral ?? null,
          });
        }
      }
    }
    return result;
  }

  private extraerEstados(body: any): MessageStatusUpdate[] {
    const result: MessageStatusUpdate[] = [];
    const allowedStatuses = new Set(Object.values(EstadoMensajeEnum));
    for (const entry of body?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        if (change?.field !== 'messages') continue;
        for (const status of change?.value?.statuses ?? []) {
          if (!status?.id || !allowedStatuses.has(status.status)) continue;
          const timestamp = Number(status.timestamp);
          result.push({
            metaMessageId: String(status.id),
            estado: status.status as EstadoMensajeEnum,
            fecha: Number.isFinite(timestamp)
              ? new Date(timestamp * 1000)
              : new Date(),
            error: status.errors?.length
              ? JSON.stringify(status.errors).slice(0, 2000)
              : null,
          });
        }
      }
    }
    return result;
  }

  private obtenerContenidoMensaje(message: any): string {
    switch (message?.type) {
      case 'text':
        return message?.text?.body ?? '';
      case 'button':
        return message?.button?.text ?? message?.button?.payload ?? '[Botón]';
      case 'interactive':
        return (
          message?.interactive?.button_reply?.title ??
          message?.interactive?.list_reply?.title ??
          '[Respuesta interactiva]'
        );
      case 'image':
        return message?.image?.caption ?? '[El cliente envió una imagen]';
      case 'document':
        return message?.document?.filename ?? '[El cliente envió un documento]';
      case 'audio':
        return '[El cliente envió un audio]';
      case 'video':
        return message?.video?.caption ?? '[El cliente envió un video]';
      case 'location':
        return '[El cliente compartió una ubicación]';
      default:
        return `[Mensaje tipo: ${message?.type ?? 'desconocido'}]`;
    }
  }

  private async procesarEstadoMensaje(status: MessageStatusUpdate) {
    const repository = this.dataSource.getRepository(Mensaje);
    const message = await repository.findOne({
      where: { meta_message_id: status.metaMessageId },
      relations: { lead: true },
    });
    if (!message) {
      this.logger.warn(
        `Estado recibido para mensaje desconocido ${status.metaMessageId}`,
      );
      return null;
    }

    message.estado = status.estado;
    message.fecha_meta = status.fecha;
    message.error_meta = status.error;
    await repository.save(message);

    if (message.lead?.asesor_id) {
      this.notificacionGateway.notificarEstadoMensaje(message.lead.asesor_id, {
        leadId: message.lead_id,
        mensajeId: Number(message.id),
        estado: message.estado,
        fecha: message.fecha_meta,
      });
    }
    return { mensajeId: Number(message.id), estado: message.estado };
  }

  private async procesarMensajeEntrante(message: IncomingMessage) {
    try {
      const result = await this.dataSource.transaction(async (manager) => {
        const messageRepository = manager.getRepository(Mensaje);
        const duplicate = await messageRepository.findOne({
          where: { meta_message_id: message.metaMessageId },
          relations: { lead: true },
        });
        if (duplicate) {
          return {
            duplicate: true,
            lead: duplicate.lead,
            advisorId: duplicate.lead?.asesor_id ?? null,
            storedMessage: duplicate,
          };
        }

        const leadRepository = manager.getRepository(Lead);
        const advisorRepository = manager.getRepository(Asesor);
        let lead = await leadRepository.findOne({
          where: [
            {
              phone_number_id: message.phoneNumberId,
              telefono: message.telefonoCliente,
            },
            {
              phone_number_id: IsNull(),
              telefono: message.telefonoCliente,
            },
          ],
        });

        let advisor: Asesor | null = null;
        if (lead?.asesor_id) {
          advisor = await advisorRepository.findOne({
            where: { id: lead.asesor_id },
          });
        }
        if (!advisor) {
          advisor = await advisorRepository
            .createQueryBuilder('advisor')
            .setLock('pessimistic_write')
            .where('advisor.activo = :active', { active: true })
            .orderBy('advisor.fecha_ultima_asignacion', 'ASC')
            .addOrderBy('advisor.id', 'ASC')
            .getOne();
          if (!advisor) {
            throw new ServiceUnavailableException(
              'No existen asesores disponibles',
            );
          }
          advisor.fecha_ultima_asignacion = new Date();
          await advisorRepository.save(advisor);
        }

        if (!lead) {
          lead = leadRepository.create({
            nombre: message.nombreCliente,
            telefono: message.telefonoCliente,
            mensaje_inicial: message.contenido,
            phone_number_id: message.phoneNumberId,
            asesor_id: advisor.id,
            estado: EstadoLeadEnum.NUEVO,
            origen: message.referral
              ? OrigenLeadEnum.FACEBOOK_ADS_WHATSAPP
              : OrigenLeadEnum.WHATSAPP_ORGANICO,
            ad_source_id: message.referral?.source_id ?? null,
            ad_source_url: message.referral?.source_url ?? null,
            ad_headline: message.referral?.headline ?? null,
            ctwa_clid: message.referral?.ctwa_clid ?? null,
            ultima_interaccion_cliente: message.fechaMensaje,
            mensajes_no_leidos: 1,
            proxima_accion: null,
            fecha_proximo_seguimiento: null,
            motivo_cierre: null,
            fecha_cierre: null,
          });
        } else {
          lead.asesor_id = advisor.id;
          lead.phone_number_id = message.phoneNumberId;
          lead.ultima_interaccion_cliente = message.fechaMensaje;
          lead.mensajes_no_leidos = (lead.mensajes_no_leidos ?? 0) + 1;
          if (lead.nombre === 'Cliente de WhatsApp') {
            lead.nombre = message.nombreCliente;
          }
        }
        lead = await leadRepository.save(lead);

        const storedMessage = await messageRepository.save(
          messageRepository.create({
            lead_id: lead.id,
            direccion: DireccionMensajeEnum.ENTRANTE,
            tipo: message.tipoMensaje,
            contenido: message.contenido,
            meta_message_id: message.metaMessageId,
            estado: EstadoMensajeEnum.RECEIVED,
            error_meta: null,
            fecha_meta: message.fechaMensaje,
            fecha: message.fechaMensaje,
          }),
        );

        return { duplicate: false, lead, advisorId: advisor.id, storedMessage };
      });

      if (!result.duplicate && result.advisorId) {
        this.notificacionGateway.notificarNuevoMensaje(result.advisorId, {
          leadId: result.lead.id,
          nombre: result.lead.nombre,
          telefono: result.lead.telefono,
          mensaje: message.contenido,
          tipo: message.tipoMensaje,
          fecha: message.fechaMensaje,
        });
      }
      return {
        ok: true,
        duplicado: result.duplicate,
        leadId: result.lead.id,
        asesorId: result.advisorId,
        mensajeId: Number(result.storedMessage.id),
      };
    } catch (error: any) {
      if (error?.code === 'ER_DUP_ENTRY') {
        const existing = await this.dataSource.getRepository(Mensaje).findOne({
          where: { meta_message_id: message.metaMessageId },
        });
        if (existing) {
          return {
            ok: true,
            duplicado: true,
            leadId: existing.lead_id,
            asesorId: null,
            mensajeId: Number(existing.id),
          };
        }
      }
      this.logger.error(
        `No se pudo procesar el mensaje ${message.metaMessageId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
