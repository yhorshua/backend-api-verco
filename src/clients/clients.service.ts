// clients.service.ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '../database/entities/client.entity';
import { CreateClientDto } from './dto/create-client.dto';

function onlyDigits(s: string) {
  return String(s ?? '').replace(/\D/g, '');
}

function normalizeCode(v: string) {
  return String(v ?? '').trim();
}

function normalizeText(v?: string): string | null {
  const s = String(v ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  return s.length ? s : null;
}

function normalizeComparableText(v?: string): string | null {
  const s = normalizeText(v);
  return s ? s.toLocaleLowerCase('es-PE') : null;
}

function normalizePhone(v?: string): string | null {
  const digits = onlyDigits(v ?? '');
  return digits.length ? digits : null;
}

function validateDocByCode(code: string, num: string) {
  const digits = onlyDigits(num);
  if (code === '01' && digits.length !== 8) return 'DNI debe tener 8 dígitos';
  if (code === '06' && digits.length !== 11) return 'RUC debe tener 11 dígitos';
  return null;
}

type DuplicateField = 'document' | 'business_name' | 'phone' | 'trade_name';

function duplicateFieldLabel(field: DuplicateField, documentType: string) {
  if (field === 'document') return documentType === '06' ? 'RUC' : 'DNI';
  if (field === 'business_name') return 'nombre o razón social';
  if (field === 'phone') return 'teléfono';
  return 'nombre comercial';
}

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
  ) {}

  async createOrClaim(dto: CreateClientDto, sellerId: number) {
    const document_type = normalizeCode(dto.document_type_code); // ✅ code
    const document_number = onlyDigits(dto.document_number);
    const business_name = normalizeText(dto.business_name);
    const comparableBusinessName = normalizeComparableText(dto.business_name);
    const trade_name = normalizeText(dto.trade_name);
    const comparableTradeName = normalizeComparableText(dto.trade_name);
    const phone = normalizePhone(dto.phone);

    const docErr = validateDocByCode(document_type, document_number);
    if (docErr) throw new BadRequestException(docErr);

    if (!business_name || !comparableBusinessName) {
      throw new BadRequestException('Razón social / nombre es obligatorio');
    }

    const conditions = [
      '(client.document_type = :documentType AND client.document_number = :documentNumber)',
      'LOWER(TRIM(client.business_name)) = :businessName',
    ];
    const parameters: Record<string, string> = {
      documentType: document_type,
      documentNumber: document_number,
      businessName: comparableBusinessName,
    };

    if (comparableTradeName) {
      conditions.push('LOWER(TRIM(client.trade_name)) = :tradeName');
      parameters.tradeName = comparableTradeName;
    }

    if (phone) {
      conditions.push(
        "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(client.phone), ' ', ''), '-', ''), '(', ''), ')', ''), '+', ''), '.', '') = :phone",
      );
      parameters.phone = phone;
    }

    const possibleDuplicates = await this.clientRepository
      .createQueryBuilder('client')
      .where(conditions.join(' OR '), parameters)
      .getMany();

    const duplicateMatches = possibleDuplicates
      .map((client): { client: Client; field: DuplicateField } | null => {
        if (
          client.document_type === document_type &&
          onlyDigits(client.document_number) === document_number
        ) {
          return { client, field: 'document' };
        }
        if (
          normalizeComparableText(client.business_name) ===
          comparableBusinessName
        ) {
          return { client, field: 'business_name' };
        }
        if (phone && normalizePhone(client.phone ?? undefined) === phone) {
          return { client, field: 'phone' };
        }
        if (
          comparableTradeName &&
          normalizeComparableText(client.trade_name ?? undefined) ===
            comparableTradeName
        ) {
          return { client, field: 'trade_name' };
        }
        return null;
      })
      .filter(
        (match): match is { client: Client; field: DuplicateField } =>
          match !== null,
      );

    if (duplicateMatches.length) {
      const matchAssignedToAnotherSeller = duplicateMatches.find(
        ({ client }) =>
          client.seller_id !== null &&
          Number(client.seller_id) !== Number(sellerId),
      );
      const match = matchAssignedToAnotherSeller ?? duplicateMatches[0];
      const fieldLabel = duplicateFieldLabel(match.field, document_type);

      if (
        match.client.seller_id !== null &&
        Number(match.client.seller_id) !== Number(sellerId)
      ) {
        throw new ConflictException(
          `Ya existe un cliente con el mismo ${fieldLabel} y tiene un vendedor asignado.`,
        );
      }

      if (match.client.seller_id !== null) {
        throw new ConflictException(
          `Este cliente ya está registrado en tu cartera con el mismo ${fieldLabel}.`,
        );
      }

      throw new ConflictException(
        `Este cliente ya existe con el mismo ${fieldLabel} y no puede registrarse nuevamente.`,
      );
    }

    const client = this.clientRepository.create({
      document_type,
      document_number,
      business_name,
      trade_name,
      address: normalizeText(dto.address),
      district: normalizeText(dto.district),
      province: normalizeText(dto.province),
      department: normalizeText(dto.department),
      country: normalizeText(dto.country) ?? 'Perú',
      phone,
      email: normalizeText(dto.email),
      seller_id: sellerId,
      last_order_at: null,
      updated_at: new Date(),
    } as any);

    try {
      return await this.clientRepository.save(client);
    } catch (e: any) {
      if (e?.code === 'ER_DUP_ENTRY' || e?.errno === 1062) {
        throw new ConflictException('Este cliente ya está registrado.');
      }
      throw e;
    }
  }

  async findForUser(userId: number, roleName: string) {
    const role = String(roleName || '').toLowerCase();

    // ✅ admin/jefe ventas ve todo
    if (
      role === 'administrador' ||
      role === 'admin' ||
      role === 'jefe ventas' ||
      role === 'jefe_ventas'
    ) {
      return this.clientRepository.find({
        order: { created_at: 'DESC' as any },
        take: 500,
      });
    }

    return this.clientRepository.find({
      where: { seller_id: userId } as any,
      order: { created_at: 'DESC' as any },
      take: 500,
    });
  }
}
