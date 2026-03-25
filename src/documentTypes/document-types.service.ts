import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentType } from '../database/entities/document-types.entity';

export type DocumentTypeDto = {
  code: string;        // '01', '06', etc
  name: string;        // 'DNI', 'RUC', ...
  description: string; // texto largo
};

function normalizeNameFromDescription(description: string) {
  const d = String(description ?? '').trim().toUpperCase();

  // Ajusta si tu tabla ya viene como "DNI", "RUC", etc.
  // Si viene "Documento Nacional de Identidad", lo convertimos a "DNI".
  if (d.includes('IDENTIDAD') || d === 'DNI') return 'DNI';
  if (d.includes('RUC') || d.includes('REGISTRO') || d === 'RUC') return 'RUC';

  // fallback: primera palabra o descripción completa (corto)
  return d.length > 20 ? d.slice(0, 20) : d;
}

@Injectable()
export class DocumentTypesService {
  constructor(
    @InjectRepository(DocumentType)
    private readonly repo: Repository<DocumentType>,
  ) {}

  async findAll(): Promise<DocumentTypeDto[]> {
    const rows = await this.repo.find({ order: { code: 'ASC' as any } });

    return rows.map((r) => ({
      code: r.code,
      name: normalizeNameFromDescription(r.description),
      description: r.description,
    }));
  }
}
