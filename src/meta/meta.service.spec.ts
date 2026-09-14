import { createHmac } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';

import { EstadoLeadEnum, OrigenLeadEnum } from '../database/entities/lead.entity';
import { DireccionMensajeEnum, EstadoMensajeEnum } from '../database/entities/mensaje.entity';
import { MetaWebhookService } from './meta.service';

describe('MetaWebhookService', () => {
  const gateway = {
    notificarNuevoMensaje: jest.fn(),
    notificarEstadoMensaje: jest.fn(),
  };
  const repository = { findOne: jest.fn(), save: jest.fn() };
  const dataSource = {
    getRepository: jest.fn(() => repository),
    transaction: jest.fn(),
  };
  let service: MetaWebhookService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.META_APP_SECRET = 'test-secret';
    service = new MetaWebhookService(dataSource as any, gateway as any);
  });

  it('accepts only a valid HMAC signature over the raw request body', () => {
    const body = Buffer.from('{"object":"whatsapp_business_account"}');
    const signature = `sha256=${createHmac('sha256', 'test-secret')
      .update(body)
      .digest('hex')}`;
    expect(() => service.validarFirma(body, signature)).not.toThrow();
    expect(() => service.validarFirma(body, 'sha256=invalid')).toThrow(
      UnauthorizedException,
    );
  });

  it('persists delivery status updates and notifies only the assigned scope', async () => {
    repository.findOne.mockResolvedValue({
      id: 4,
      lead_id: 9,
      estado: EstadoMensajeEnum.SENT,
      lead: { id: 9, asesor_id: 2 },
    });
    repository.save.mockImplementation(async (value) => value);

    const response = await service.procesarWebhook({
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          field: 'messages',
          value: { statuses: [{ id: 'wamid.4', status: 'read', timestamp: '1789160400' }] },
        }],
      }],
    });

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ estado: EstadoMensajeEnum.READ }),
    );
    expect(gateway.notificarEstadoMensaje).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ leadId: 9, estado: EstadoMensajeEnum.READ }),
    );
    expect(response.estadosProcesados).toBe(1);
  });

  it('treats repeated incoming Meta messages as idempotent', async () => {
    const duplicate = {
      id: 8,
      lead_id: 9,
      direccion: DireccionMensajeEnum.ENTRANTE,
      estado: EstadoMensajeEnum.RECEIVED,
      lead: {
        id: 9,
        asesor_id: 2,
        estado: EstadoLeadEnum.NUEVO,
        origen: OrigenLeadEnum.WHATSAPP_ORGANICO,
      },
    };
    const transactionRepository = { findOne: jest.fn().mockResolvedValue(duplicate) };
    dataSource.transaction.mockImplementation(async (callback) =>
      callback({ getRepository: () => transactionRepository }),
    );

    const response = await service.procesarWebhook({
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          field: 'messages',
          value: {
            metadata: { phone_number_id: 'phone-id' },
            contacts: [{ wa_id: '51999999999', profile: { name: 'Prueba' } }],
            messages: [{
              id: 'wamid.8',
              from: '51999999999',
              timestamp: '1789160400',
              type: 'text',
              text: { body: 'Hola' },
            }],
          },
        }],
      }],
    });

    expect(response.mensajes[0]).toEqual(
      expect.objectContaining({ duplicado: true, leadId: 9, mensajeId: 8 }),
    );
    expect(gateway.notificarNuevoMensaje).not.toHaveBeenCalled();
  });
});
