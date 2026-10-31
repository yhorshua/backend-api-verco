import { ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Client } from '../database/entities/client.entity';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';

describe('ClientsService', () => {
  const queryBuilder = {
    where: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };
  const repository = {
    createQueryBuilder: jest.fn(() => queryBuilder),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({ id: 1, ...value })),
  } as unknown as Repository<Client>;
  const service = new ClientsService(repository);

  const dto: CreateClientDto = {
    document_type_code: '06',
    document_number: '20123456789',
    business_name: 'Inversiones Verco S.A.C.',
    trade_name: 'Verco Mayorista',
    phone: '(01) 555-1234',
  };

  function existingClient(overrides: Partial<Client> = {}): Client {
    return {
      id: 15,
      document_type: '06',
      document_number: '20123456789',
      business_name: 'Inversiones Verco S.A.C.',
      trade_name: 'Verco Mayorista',
      address: null,
      district: null,
      province: null,
      department: null,
      country: 'Perú',
      phone: '015551234',
      email: null,
      seller_id: 9,
      seller: null,
      docType: null as any,
      last_order_at: null,
      created_at: new Date(),
      updated_at: null,
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    queryBuilder.where.mockReturnThis();
    queryBuilder.getMany.mockResolvedValue([]);
  });

  it('bloquea un documento que pertenece a otro vendedor', async () => {
    queryBuilder.getMany.mockResolvedValue([existingClient({ seller_id: 9 })]);

    await expect(service.createOrClaim(dto, 3)).rejects.toThrow(
      'Ya existe un cliente con el mismo RUC y tiene un vendedor asignado.',
    );
  });

  it('bloquea un teléfono que ya está registrado en la cartera del vendedor', async () => {
    queryBuilder.getMany.mockResolvedValue([
      existingClient({
        document_number: '20999999991',
        business_name: 'Otro cliente',
        trade_name: 'Otra marca',
        seller_id: 3,
      }),
    ]);

    await expect(service.createOrClaim(dto, 3)).rejects.toThrow(
      'Este cliente ya está registrado en tu cartera con el mismo teléfono.',
    );
  });

  it('bloquea un nombre o razón social que pertenece a otro vendedor', async () => {
    queryBuilder.getMany.mockResolvedValue([
      existingClient({
        document_number: '20999999991',
        trade_name: 'Otra marca',
        phone: '999999999',
        seller_id: 9,
      }),
    ]);

    await expect(service.createOrClaim(dto, 3)).rejects.toThrow(
      'Ya existe un cliente con el mismo nombre o razón social y tiene un vendedor asignado.',
    );
  });

  it('bloquea un nombre comercial existente aunque no tenga vendedor', async () => {
    expect.assertions(2);
    queryBuilder.getMany.mockResolvedValue([
      existingClient({
        document_number: '20999999991',
        business_name: 'Otro cliente',
        phone: '999999999',
        seller_id: null,
      }),
    ]);

    try {
      await service.createOrClaim(dto, 3);
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as Error).message).toBe(
        'Este cliente ya existe con el mismo nombre comercial y no puede registrarse nuevamente.',
      );
    }
  });

  it('crea el cliente y normaliza nombres y teléfono cuando no hay duplicados', async () => {
    const result = await service.createOrClaim(
      {
        ...dto,
        business_name: '  Inversiones   Verco S.A.C.  ',
        trade_name: '  Verco   Mayorista ',
      },
      3,
    );

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        business_name: 'Inversiones Verco S.A.C.',
        trade_name: 'Verco Mayorista',
        phone: '015551234',
        seller_id: 3,
      }),
    );
    expect(result).toEqual(expect.objectContaining({ id: 1, seller_id: 3 }));
  });
});
