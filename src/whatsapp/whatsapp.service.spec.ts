import { of, throwError } from 'rxjs';

import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { EstadoLeadEnum, OrigenLeadEnum } from '../database/entities/lead.entity';
import { LeadHistory } from '../database/entities/lead-history.entity';
import { EstadoMensajeEnum } from '../database/entities/mensaje.entity';
import { WhatsAppService } from './whatsapp.service';

const admin = { userId: 1, role: 'Administrador' };

function lead(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    nombre: 'Prospecto',
    telefono: '51999999999',
    estado: EstadoLeadEnum.NUEVO,
    origen: OrigenLeadEnum.WHATSAPP_ORGANICO,
    asesor_id: 2,
    asesor: null,
    phone_number_id: 'phone-id',
    mensajes_no_leidos: 1,
    fecha_registro: new Date(),
    proxima_accion: null,
    fecha_proximo_seguimiento: null,
    fecha_cierre: null,
    motivo_cierre: null,
    ...overrides,
  } as any;
}

describe('WhatsAppService', () => {
  const httpService = { post: jest.fn() };
  const leadRepo = { findOne: jest.fn(), save: jest.fn() };
  const messageRepo = {
    create: jest.fn((value) => value),
    save: jest.fn(),
    findAndCount: jest.fn(),
  };
  const advisorRepo = { findOne: jest.fn() };
  const historyRepo = { findAndCount: jest.fn() };
  const dataSource = { transaction: jest.fn() };
  let service: WhatsAppService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.META_WHATSAPP_ACCESS_TOKEN = 'test-token';
    process.env.META_GRAPH_API_VERSION = 'v-test';
    process.env.WHATSAPP_PHONE_NUMBER_ID = 'test-phone-id';
    service = new WhatsAppService(
      httpService as any,
      dataSource as any,
      leadRepo as any,
      messageRepo as any,
      advisorRepo as any,
      historyRepo as any,
    );
  });

  it('rejects an advisor account without an active advisor mapping', async () => {
    advisorRepo.findOne.mockResolvedValue(null);
    await expect(
      service.listarMensajes(1, { page: 1, limit: 50 }, {
        userId: 8,
        role: 'Vendedor Web',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('persists pending before sending and then stores the Meta identifier', async () => {
    leadRepo.findOne.mockResolvedValue(lead());
    let nextId = 1;
    messageRepo.save.mockImplementation(async (value) => ({
      id: value.id ?? nextId++,
      fecha: value.fecha ?? new Date(),
      ...value,
    }));
    httpService.post.mockReturnValue(of({ data: { messages: [{ id: 'wamid.1' }] } }));

    const response = await service.enviarMensaje(10, 'Hola', admin);

    expect(messageRepo.save).toHaveBeenCalledTimes(2);
    expect(messageRepo.save.mock.calls[0][0].estado).toBe(EstadoMensajeEnum.PENDING);
    expect(messageRepo.save.mock.calls[1][0]).toMatchObject({
      estado: EstadoMensajeEnum.SENT,
      meta_message_id: 'wamid.1',
    });
    expect(response.data.estado).toBe(EstadoMensajeEnum.SENT);
  });

  it('keeps a failed outbound message trace when Meta rejects it', async () => {
    leadRepo.findOne.mockResolvedValue(lead());
    messageRepo.save.mockImplementation(async (value) => ({
      id: value.id ?? 1,
      fecha: value.fecha ?? new Date(),
      ...value,
    }));
    httpService.post.mockReturnValue(
      throwError(() => ({ response: { data: { error: { code: 131000 } } } })),
    );

    await expect(service.enviarMensaje(10, 'Hola', admin)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(messageRepo.save.mock.calls[1][0].estado).toBe(EstadoMensajeEnum.FAILED);
    expect(messageRepo.save.mock.calls[1][0].error_meta).toContain('131000');
  });

  it('updates an open stage and its audit record in the same transaction', async () => {
    const storedLead = lead();
    const transactionLeadRepo = {
      findOne: jest.fn().mockResolvedValue(storedLead),
      save: jest.fn(async (value) => value),
    };
    const transactionHistoryRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };
    const manager = {
      getRepository: jest.fn((entity) =>
        entity === LeadHistory ? transactionHistoryRepo : transactionLeadRepo,
      ),
    };
    dataSource.transaction.mockImplementation(async (callback) => callback(manager));
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();

    await service.actualizarEstado(
      10,
      {
        estado: EstadoLeadEnum.CONTACTADO,
        fechaProximoSeguimiento: tomorrow,
        proximaAccion: 'Llamar',
      },
      admin,
    );

    expect(transactionLeadRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        estado: EstadoLeadEnum.CONTACTADO,
        proxima_accion: 'Llamar',
      }),
    );
    expect(transactionHistoryRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        estado_anterior: EstadoLeadEnum.NUEVO,
        estado_nuevo: EstadoLeadEnum.CONTACTADO,
        usuario_id: 1,
      }),
    );
  });
});
