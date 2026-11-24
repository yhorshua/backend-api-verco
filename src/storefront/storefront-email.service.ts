import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EcommerceClaim } from '../database/entities/ecommerce-claim.entity';

export type EmailDeliveryStatus = 'SENT' | 'SKIPPED' | 'FAILED';

@Injectable()
export class StorefrontEmailService {
  private readonly logger = new Logger(StorefrontEmailService.name);

  constructor(private readonly config: ConfigService) {}

  async sendClaimRegistered(claim: EcommerceClaim): Promise<EmailDeliveryStatus> {
    const code = claim.claim_code ?? `LR-${claim.id}`;
    const date = this.peruDate(claim.created_at);
    const consumer = this.escape(claim.consumer_name);
    const detail = this.escape(claim.detail);
    const request = this.escape(claim.consumer_request);
    const item = this.escape(claim.item_description);

    const consumerEmail = this.send({
      to: claim.consumer_email,
      subject: `Constancia de ${claim.claim_type.toLowerCase()} ${code} - Soomin Store`,
      html: `<h1>Hemos recibido tu ${claim.claim_type.toLowerCase()}</h1><p>Hola ${consumer},</p><p>Tu registro fue recibido correctamente por Soomin Store.</p><p><strong>Código:</strong> ${code}<br><strong>Fecha:</strong> ${date}<br><strong>Bien o servicio:</strong> ${item}</p><p><strong>Detalle:</strong><br>${detail}</p><p><strong>Solicitud:</strong><br>${request}</p><p>Conserva este código para consultar el estado de tu registro. Puedes responder directamente a este correo.</p>`,
      text: `Soomin Store recibió tu ${claim.claim_type.toLowerCase()}. Código: ${code}. Fecha: ${date}. Bien o servicio: ${claim.item_description}. Detalle: ${claim.detail}. Solicitud: ${claim.consumer_request}.`,
      idempotencyKey: `claim-${claim.id}-registered-consumer`,
    });
    const internalEmail = this.send({
      to: this.claimsAddress(),
      subject: `Nuevo ${claim.claim_type.toLowerCase()} ${code} - Libro de Reclamaciones`,
      html: `<h1>Nuevo registro en el Libro de Reclamaciones</h1><p><strong>Código:</strong> ${code}<br><strong>Fecha:</strong> ${date}<br><strong>Consumidor:</strong> ${consumer}<br><strong>Documento:</strong> ${this.escape(claim.document_type)} ${this.escape(claim.document_number)}<br><strong>Correo:</strong> ${this.escape(claim.consumer_email)}<br><strong>Teléfono:</strong> ${this.escape(claim.consumer_phone)}</p><p><strong>Bien o servicio:</strong> ${item}</p><p><strong>Detalle:</strong><br>${detail}</p><p><strong>Solicitud:</strong><br>${request}</p>`,
      text: `Nuevo registro ${code}. Consumidor: ${claim.consumer_name}. Correo: ${claim.consumer_email}. Detalle: ${claim.detail}. Solicitud: ${claim.consumer_request}.`,
      idempotencyKey: `claim-${claim.id}-registered-internal`,
    });
    return this.combine(await Promise.all([consumerEmail, internalEmail]));
  }

  async sendClaimResponse(claim: EcommerceClaim): Promise<EmailDeliveryStatus> {
    return this.send({
      to: claim.consumer_email,
      subject: `Respuesta a ${claim.claim_code ?? `LR-${claim.id}`} - Soomin Store`,
      html: `<h1>Respuesta de Soomin Store</h1><p>Hola ${this.escape(claim.consumer_name)},</p><p>Hemos atendido tu registro <strong>${this.escape(claim.claim_code ?? String(claim.id))}</strong>.</p><p><strong>Acciones realizadas:</strong><br>${this.escape(claim.provider_actions ?? '')}</p><p><strong>Respuesta:</strong><br>${this.escape(claim.provider_response ?? '')}</p><p>Si necesitas alguna aclaración, responde directamente a este correo.</p>`,
      text: `Respuesta al registro ${claim.claim_code}. Acciones realizadas: ${claim.provider_actions ?? ''}. Respuesta: ${claim.provider_response ?? ''}.`,
      idempotencyKey: `claim-${claim.id}-response`,
    });
  }

  private async send(input: { to: string; subject: string; html: string; text: string; idempotencyKey: string }): Promise<EmailDeliveryStatus> {
    const apiKey = this.config.get<string>('RESEND_API_KEY')?.trim();
    if (!apiKey) {
      this.logger.warn(`Correo omitido (${input.idempotencyKey}): RESEND_API_KEY no configurada`);
      return 'SKIPPED';
    }
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': input.idempotencyKey,
        },
        body: JSON.stringify({
          from: this.fromAddress(),
          reply_to: this.salesAddress(),
          to: [input.to],
          subject: input.subject,
          html: input.html,
          text: input.text,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        const detail = await response.text();
        this.logger.error(`Resend rechazó ${input.idempotencyKey}: ${response.status} ${detail.slice(0, 300)}`);
        return 'FAILED';
      }
      return 'SENT';
    } catch (error) {
      this.logger.error(`No se pudo enviar ${input.idempotencyKey}: ${error instanceof Error ? error.message : 'error desconocido'}`);
      return 'FAILED';
    }
  }

  private combine(statuses: EmailDeliveryStatus[]): EmailDeliveryStatus {
    if (statuses.every((status) => status === 'SENT')) return 'SENT';
    if (statuses.every((status) => status === 'SKIPPED')) return 'SKIPPED';
    return 'FAILED';
  }

  private salesAddress() { return this.config.get<string>('EMAIL_SALES_ADDRESS')?.trim() || 'ventas@soomin.online'; }
  private claimsAddress() { return this.config.get<string>('EMAIL_CLAIMS_TO')?.trim() || this.salesAddress(); }
  private fromAddress() { return this.config.get<string>('EMAIL_FROM')?.trim() || `Soomin Store <${this.salesAddress()}>`; }
  private peruDate(value: Date) { return new Intl.DateTimeFormat('es-PE', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Lima' }).format(value); }
  private escape(value: string) { return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character).replace(/\n/g, '<br>'); }
}
