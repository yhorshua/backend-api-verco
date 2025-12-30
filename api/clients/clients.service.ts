import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '../database/entities/client.entity';
import { CreateClientDto } from './dto/create-client.dto';

function normalizeDocType(v: string) {
  return String(v ?? '').trim().toUpperCase();
}
function normalizeDocNumber(v: string) {
  return String(v ?? '').trim();
}
function normalizeText(v?: string) {
  const s = String(v ?? '').trim();
  return s.length ? s : null;
}

function isStale(last: Date | null, months = 6) {
  // si nunca tuvo pedido: consideramos “libre” (stale = true)
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

  /**
   * Crea cliente o devuelve el existente respetando la política de 6 meses.
   */
  async createOrClaim(dto: CreateClientDto, sellerId: number) {
    const document_type = normalizeDocType(dto.document_type);
    const document_number = normalizeDocNumber(dto.document_number);

    if (!document_type || !document_number) {
      throw new BadRequestException('document_type y document_number son obligatorios');
    }

    // 🔎 Buscar si ya existe
    const existing = await this.clientRepository.findOne({
      where: { document_type, document_number } as any,
    });

    // ✅ Si no existe, creamos y asignamos al vendedor
    if (!existing) {
      const client = this.clientRepository.create({
        document_type,
        document_number,
        business_name: String(dto.business_name).trim(),
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
        // por si entra en carrera y el unique se dispara
        throw new BadRequestException('Este cliente ya está registrado');
      }
    }

    // ✅ Si existe:
    // Si está libre -> se asigna
    if (!existing.seller_id) {
      existing.seller_id = sellerId;
    } else if (existing.seller_id !== sellerId) {
      // cliente pertenece a otro vendedor
      const stale = isStale(existing.last_order_at, 6);

      if (!stale) {
        // ❌ no está libre aún
        throw new ForbiddenException(
          'Este cliente pertenece a otro vendedor (aún activo). Solo pasa a libre después de 6 meses sin pedidos.',
        );
      }

      // ✅ está libre por inactividad -> reasignar
      existing.seller_id = sellerId;
    }

    // opcional: actualizar datos si vienen (sin pisar con vacío)
    existing.business_name = String(dto.business_name).trim();
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
    const role = String(roleName || '').trim().toLowerCase();

    // ✅ Roles que ven TODO
    const canSeeAll =
      role === 'administrador' ||
      role === 'admin' ||
      role === 'jefe ventas' ||
      role === 'jefeventas' ||
      role === 'jefe_de_ventas' ||
      role === 'sales manager';

    if (canSeeAll) {
      return this.clientRepository.find({
        order: { created_at: 'DESC' as any },
        take: 500,
      });
    }

    // ✅ vendedor ve solo sus clientes
    return this.clientRepository.find({
      where: { seller_id: userId } as any,
      order: { created_at: 'DESC' as any },
      take: 500,
    });
  }
}
