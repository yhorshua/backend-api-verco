// clients.service.ts
import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
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
  const s = String(v ?? '').trim();
  return s.length ? s : null;
}

function validateDocByCode(code: string, num: string) {
  const digits = onlyDigits(num);
  if (code === '01' && digits.length !== 8) return 'DNI debe tener 8 dígitos';
  if (code === '06' && digits.length !== 11) return 'RUC debe tener 11 dígitos';
  return null;
}

function isStale(last: Date | null, months = 6) {
  if (!last) return true;
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - months);
  return last < cutoff;
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

    const docErr = validateDocByCode(document_type, document_number);
    if (docErr) throw new BadRequestException(docErr);

    if (!dto.business_name?.trim()) {
      throw new BadRequestException('Razón social / nombre es obligatorio');
    }

    // 🔎 Buscar existente (mismo code+number)
    const existing = await this.clientRepository.findOne({
      where: { document_type, document_number } as any,
    });

    if (!existing) {
      const client = this.clientRepository.create({
        document_type,
        document_number,
        business_name: dto.business_name.trim(),
        trade_name: normalizeText(dto.trade_name),
        address: normalizeText(dto.address),
        district: normalizeText(dto.district),
        province: normalizeText(dto.province),
        department: normalizeText(dto.department),
        country: normalizeText(dto.country) ?? 'Perú',
        phone: normalizeText(dto.phone),
        email: normalizeText(dto.email),
        seller_id: sellerId,
        last_order_at: null,
        updated_at: new Date(),
      } as any);

      try {
        return await this.clientRepository.save(client);
      } catch (e: any) {
        // ✅ NO conviertas todos los errores en "ya existe"
        // Solo si es duplicado (MySQL ER_DUP_ENTRY = 1062)
        if (e?.code === 'ER_DUP_ENTRY' || e?.errno === 1062) {
          throw new BadRequestException('Este cliente ya está registrado');
        }
        throw e;
      }
    }

    // si existe: política 6 meses
    if (!existing.seller_id) {
      existing.seller_id = sellerId;
    } else if (existing.seller_id !== sellerId) {
      const stale = isStale(existing.last_order_at, 6);
      if (!stale) {
        throw new ForbiddenException(
          'Este cliente pertenece a otro vendedor (aún activo). Solo pasa a libre después de 6 meses sin pedidos.',
        );
      }
      existing.seller_id = sellerId;
    }

    // actualizar datos (sin pisar con vacío)
    existing.business_name = dto.business_name.trim();
    if (dto.trade_name !== undefined) existing.trade_name = normalizeText(dto.trade_name);
    if (dto.address !== undefined) existing.address = normalizeText(dto.address);
    if (dto.district !== undefined) existing.district = normalizeText(dto.district);
    if (dto.province !== undefined) existing.province = normalizeText(dto.province);
    if (dto.department !== undefined) existing.department = normalizeText(dto.department);
    if (dto.country !== undefined) existing.country = normalizeText(dto.country) ?? 'Perú';
    if (dto.phone !== undefined) existing.phone = normalizeText(dto.phone);
    if (dto.email !== undefined) existing.email = normalizeText(dto.email);

    existing.updated_at = new Date();
    return this.clientRepository.save(existing);
  }

  async findForUser(userId: number, roleName: string) {
    const role = String(roleName || '').toLowerCase();

    // ✅ admin/jefe ventas ve todo
    if (role === 'administrador' || role === 'admin' || role === 'jefe ventas' || role === 'jefe_ventas') {
      return this.clientRepository.find({ order: { created_at: 'DESC' as any }, take: 500 });
    }

    return this.clientRepository.find({
      where: { seller_id: userId } as any,
      order: { created_at: 'DESC' as any },
      take: 500,
    });
  }
}
