import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { Asesor } from '../database/entities/asesor.entity';
import { EstadoLeadEnum, Lead } from '../database/entities/lead.entity';
import { LeadHistory } from '../database/entities/lead-history.entity';
import {
  DireccionMensajeEnum,
  EstadoMensajeEnum,
  Mensaje,
} from '../database/entities/mensaje.entity';
import { QueryWhatsAppLeadsDto } from './dto/query-whatsapp-leads.dto';
import { QueryWhatsAppMessagesDto } from './dto/query-whatsapp-messages.dto';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto';

export interface CrmUser {
  userId: number;
  role: string;
}

const MANAGEMENT_ROLES = new Set(['Administrador', 'Jefe Ventas']);
const OPEN_STATES = new Set<EstadoLeadEnum>([
  EstadoLeadEnum.NUEVO,
  EstadoLeadEnum.ASIGNADO,
  EstadoLeadEnum.CONTACTADO,
  EstadoLeadEnum.COTIZADO,
]);

export const ALLOWED_LEAD_TRANSITIONS: Record<EstadoLeadEnum, EstadoLeadEnum[]> = {
  [EstadoLeadEnum.NUEVO]: [
    EstadoLeadEnum.ASIGNADO,
    EstadoLeadEnum.CONTACTADO,
    EstadoLeadEnum.DESCARTADO,
  ],
  [EstadoLeadEnum.ASIGNADO]: [
    EstadoLeadEnum.CONTACTADO,
    EstadoLeadEnum.DESCARTADO,
  ],
  [EstadoLeadEnum.CONTACTADO]: [
    EstadoLeadEnum.COTIZADO,
    EstadoLeadEnum.DESCARTADO,
  ],
  [EstadoLeadEnum.COTIZADO]: [
    EstadoLeadEnum.CONTACTADO,
    EstadoLeadEnum.VENDIDO,
    EstadoLeadEnum.DESCARTADO,
  ],
  [EstadoLeadEnum.VENDIDO]: [],
  [EstadoLeadEnum.DESCARTADO]: [],
};

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly dataSource: DataSource,
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
    @InjectRepository(Mensaje)
    private readonly mensajeRepo: Repository<Mensaje>,
    @InjectRepository(Asesor)
    private readonly asesorRepo: Repository<Asesor>,
    @InjectRepository(LeadHistory)
    private readonly historyRepo: Repository<LeadHistory>,
  ) {}

  async listarLeads(query: QueryWhatsAppLeadsDto, user: CrmUser) {
    const advisorId = await this.resolveAdvisorScope(user);
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;

    const builder = this.leadRepo
      .createQueryBuilder('lead')
      .leftJoinAndSelect('lead.asesor', 'asesor')
      .leftJoin('asesor.user', 'advisorUser')
      .addSelect(['advisorUser.id', 'advisorUser.full_name'])
      .addSelect(
        (subquery) =>
          subquery
            .select('message.contenido')
            .from(Mensaje, 'message')
            .where('message.lead_id = lead.id')
            .orderBy('message.fecha', 'DESC')
            .addOrderBy('message.id', 'DESC')
            .limit(1),
        'ultimoMensaje',
      )
      .addSelect(
        (subquery) =>
          subquery
            .select('message.fecha')
            .from(Mensaje, 'message')
            .where('message.lead_id = lead.id')
            .orderBy('message.fecha', 'DESC')
            .addOrderBy('message.id', 'DESC')
            .limit(1),
        'fechaUltimoMensaje',
      );

    if (advisorId !== null) {
      builder.andWhere('lead.asesor_id = :advisorId', { advisorId });
    }
    if (query.estado) {
      builder.andWhere('lead.estado = :estado', { estado: query.estado });
    }
    if (query.search) {
      builder.andWhere(
        '(LOWER(lead.nombre) LIKE :search OR lead.telefono LIKE :search)',
        { search: `%${query.search.toLowerCase()}%` },
      );
    }

    const total = await builder.clone().getCount();
    const { entities, raw } = await builder
      .orderBy('lead.ultima_interaccion_cliente', 'DESC')
      .addOrderBy('lead.fecha_registro', 'DESC')
      .addOrderBy('lead.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getRawAndEntities();

    return {
      data: entities.map((lead, index) =>
        this.mapLead(
          lead,
          raw[index]?.ultimoMensaje ?? null,
          raw[index]?.fechaUltimoMensaje ?? null,
        ),
      ),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async listarMensajes(
    leadId: number,
    query: QueryWhatsAppMessagesDto,
    user: CrmUser,
  ) {
    await this.findAccessibleLead(leadId, user);
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const [descendingMessages, total] = await this.mensajeRepo.findAndCount({
      where: { lead_id: leadId },
      order: { fecha: 'DESC', id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: descendingMessages.reverse().map((message) => this.mapMessage(message)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async listarHistorial(
    leadId: number,
    query: QueryWhatsAppMessagesDto,
    user: CrmUser,
  ) {
    await this.findAccessibleLead(leadId, user);
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const [history, total] = await this.historyRepo.findAndCount({
      where: { lead_id: leadId },
      relations: { usuario: true },
      order: { fecha: 'DESC', id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: history.map((item) => ({
        id: item.id,
        estadoAnterior: item.estado_anterior,
        estadoNuevo: item.estado_nuevo,
        observacion: item.observacion,
        usuarioId: item.usuario_id,
        usuario: item.usuario?.full_name ?? null,
        fecha: item.fecha,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async marcarComoLeido(leadId: number, user: CrmUser) {
    const lead = await this.findAccessibleLead(leadId, user);
    if (lead.mensajes_no_leidos !== 0) {
      lead.mensajes_no_leidos = 0;
      await this.leadRepo.save(lead);
    }
    return { ok: true, leadId, mensajesNoLeidos: 0 };
  }

  async actualizarEstado(
    leadId: number,
    dto: UpdateLeadStatusDto,
    user: CrmUser,
  ) {
    const advisorId = await this.resolveAdvisorScope(user);

    return this.dataSource.transaction(async (manager) => {
      const lead = await this.findAccessibleLead(
        leadId,
        user,
        manager,
        advisorId,
      );

      if (lead.estado === dto.estado) {
        return { ok: true, data: this.mapLead(lead, null, null) };
      }

      const allowed = ALLOWED_LEAD_TRANSITIONS[lead.estado] ?? [];
      if (!allowed.includes(dto.estado)) {
        throw new BadRequestException(
          `No se permite cambiar de ${lead.estado} a ${dto.estado}`,
        );
      }

      if (
        dto.estado === EstadoLeadEnum.DESCARTADO &&
        (!dto.observacion || dto.observacion.length < 3)
      ) {
        throw new BadRequestException(
          'Debe indicar el motivo al descartar una oportunidad',
        );
      }

      let followUpDate: Date | null = null;
      if (OPEN_STATES.has(dto.estado)) {
        if (!dto.fechaProximoSeguimiento) {
          throw new BadRequestException(
            'La fecha del próximo seguimiento es obligatoria mientras el proceso esté abierto',
          );
        }
        followUpDate = new Date(dto.fechaProximoSeguimiento);
        if (Number.isNaN(followUpDate.getTime()) || followUpDate < new Date()) {
          throw new BadRequestException(
            'La fecha del próximo seguimiento no puede estar en el pasado',
          );
        }
      }

      const previousStatus = lead.estado;
      lead.estado = dto.estado;
      lead.proxima_accion = OPEN_STATES.has(dto.estado)
        ? dto.proximaAccion ?? null
        : null;
      lead.fecha_proximo_seguimiento = followUpDate;
      lead.fecha_cierre = OPEN_STATES.has(dto.estado) ? null : new Date();
      lead.motivo_cierre =
        dto.estado === EstadoLeadEnum.DESCARTADO
          ? dto.observacion ?? null
          : null;

      const savedLead = await manager.getRepository(Lead).save(lead);
      const historyRepository = manager.getRepository(LeadHistory);
      await historyRepository.save(
        historyRepository.create({
          lead_id: lead.id,
          usuario_id: user.userId,
          estado_anterior: previousStatus,
          estado_nuevo: dto.estado,
          observacion: dto.observacion ?? null,
        }),
      );

      return { ok: true, data: this.mapLead(savedLead, null, null) };
    });
  }

  async enviarMensaje(leadId: number, mensaje: string, user: CrmUser) {
    const lead = await this.findAccessibleLead(leadId, user);
    const token = process.env.META_WHATSAPP_ACCESS_TOKEN;
    const version = process.env.META_GRAPH_API_VERSION;
    const phoneNumberId =
      lead.phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!token || !version || !phoneNumberId) {
      throw new ServiceUnavailableException(
        'La integración de WhatsApp no está configurada',
      );
    }

    let storedMessage = await this.mensajeRepo.save(
      this.mensajeRepo.create({
        lead_id: lead.id,
        direccion: DireccionMensajeEnum.SALIENTE,
        tipo: 'text',
        contenido: mensaje,
        meta_message_id: null,
        estado: EstadoMensajeEnum.PENDING,
        error_meta: null,
        fecha_meta: null,
      }),
    );

    const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          url,
          {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: lead.telefono,
            type: 'text',
            text: { body: mensaje },
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const metaMessageId = response.data?.messages?.[0]?.id;
      if (!metaMessageId) {
        throw new Error('Meta no devolvió el identificador del mensaje');
      }

      storedMessage.meta_message_id = metaMessageId;
      storedMessage.estado = EstadoMensajeEnum.SENT;
      storedMessage.fecha_meta = new Date();
      storedMessage = await this.mensajeRepo.save(storedMessage);
      return { ok: true, data: this.mapMessage(storedMessage) };
    } catch (error: any) {
      storedMessage.estado = EstadoMensajeEnum.FAILED;
      storedMessage.error_meta = this.safeMetaError(error);
      storedMessage.fecha_meta = new Date();
      await this.mensajeRepo.save(storedMessage);
      this.logger.warn(`WhatsApp rechazó el mensaje local ${storedMessage.id}`);
      throw new ServiceUnavailableException(
        'No se pudo enviar el mensaje por WhatsApp',
      );
    }
  }

  private async resolveAdvisorScope(user: CrmUser): Promise<number | null> {
    if (MANAGEMENT_ROLES.has(user.role)) return null;
    const advisor = await this.asesorRepo.findOne({
      where: { user_id: user.userId, activo: true },
    });
    if (!advisor) {
      throw new ForbiddenException(
        'El usuario no está configurado como asesor activo',
      );
    }
    return advisor.id;
  }

  private async findAccessibleLead(
    leadId: number,
    user: CrmUser,
    manager?: EntityManager,
    resolvedAdvisorId?: number | null,
  ): Promise<Lead> {
    const repository = manager ? manager.getRepository(Lead) : this.leadRepo;
    const advisorId =
      resolvedAdvisorId === undefined
        ? await this.resolveAdvisorScope(user)
        : resolvedAdvisorId;
    const lead = await repository.findOne({
      where:
        advisorId === null
          ? { id: leadId }
          : { id: leadId, asesor_id: advisorId },
      relations: { asesor: { user: true } },
    });
    if (!lead) throw new NotFoundException('Lead no encontrado');
    return lead;
  }

  private mapLead(
    lead: Lead,
    lastMessage: string | null,
    lastMessageDate: Date | string | null,
  ) {
    return {
      id: lead.id,
      nombre: lead.nombre,
      telefono: lead.telefono,
      estado: lead.estado,
      origen: lead.origen,
      asesorId: lead.asesor_id,
      asesor: lead.asesor?.user?.full_name ?? null,
      ultimoMensaje: lastMessage,
      fechaUltimoMensaje: lastMessageDate,
      mensajesNoLeidos: lead.mensajes_no_leidos,
      fechaRegistro: lead.fecha_registro,
      proximaAccion: lead.proxima_accion,
      fechaProximoSeguimiento: lead.fecha_proximo_seguimiento,
      fechaCierre: lead.fecha_cierre,
      motivoCierre: lead.motivo_cierre,
    };
  }

  private mapMessage(message: Mensaje) {
    return {
      id: Number(message.id),
      leadId: message.lead_id,
      direccion: message.direccion,
      tipo: message.tipo,
      contenido: message.contenido,
      fecha: message.fecha,
      estado: message.estado,
    };
  }

  private safeMetaError(error: any): string {
    return JSON.stringify({
      code: error?.response?.data?.error?.code ?? null,
      type: error?.response?.data?.error?.type ?? null,
      message: String(
        error?.response?.data?.error?.message ??
          error?.message ??
          'Error desconocido',
      ).slice(0, 500),
    });
  }
}
