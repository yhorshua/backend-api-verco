import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { EstadoLeadEnum } from '../database/entities/lead.entity';
import { QueryWhatsAppLeadsDto } from './dto/query-whatsapp-leads.dto';
import { SendWhatsAppMessageDto } from './dto/SendWhatsAppMessageDto';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto';
import { ALLOWED_LEAD_TRANSITIONS } from './whatsapp.service';

describe('CRM contracts and commercial rules', () => {
  it('normalizes the outbound message and validates its maximum length', async () => {
    const dto = plainToInstance(SendWhatsAppMessageDto, {
      leadId: '7',
      mensaje: '  Hola  ',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto).toEqual({ leadId: 7, mensaje: 'Hola' });
  });

  it('rejects invalid pagination and unknown lead states', async () => {
    const query = plainToInstance(QueryWhatsAppLeadsDto, {
      page: 0,
      limit: 101,
      estado: 'PENDIENTE',
    });
    const errors = await validate(query);
    expect(errors.map((error) => error.property).sort()).toEqual([
      'estado',
      'limit',
      'page',
    ]);
  });

  it('requires a valid enum value in status updates', async () => {
    const dto = plainToInstance(UpdateLeadStatusDto, { estado: 'CERRADO' });
    expect((await validate(dto)).map((error) => error.property)).toContain('estado');
  });

  it('keeps won and discarded states terminal', () => {
    expect(ALLOWED_LEAD_TRANSITIONS[EstadoLeadEnum.VENDIDO]).toEqual([]);
    expect(ALLOWED_LEAD_TRANSITIONS[EstadoLeadEnum.DESCARTADO]).toEqual([]);
  });
});
