// src/cash/cash.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CashRegisterSession } from '../database/entities/cash-register-session.entity';
import { OpenCashDto } from './dto/cash-open.dto';

@Injectable()
export class CashService {
  constructor(
    @InjectRepository(CashRegisterSession)
    private readonly sessionRepo: Repository<CashRegisterSession>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * ✅ Abrir caja por tienda (warehouse)
   * Regla: si ya existe OPEN para warehouse_id => error
   */
  async openCash(dto: OpenCashDto) {
    return this.dataSource.transaction(async (manager) => {
      // Bloqueo para evitar doble apertura simultánea
      const openRows = await manager.query(
        `SELECT id
         FROM CashRegisterSessions
         WHERE warehouse_id = ? AND status = 'OPEN'
         ORDER BY opened_at DESC
         LIMIT 1
         FOR UPDATE`,
        [dto.warehouse_id],
      );

      if (openRows.length) {
        throw new BadRequestException(
          `Ya existe una caja ABIERTA para warehouse_id=${dto.warehouse_id}. Debes cerrarla antes de abrir otra.`,
        );
      }

      const opening = Number(dto.opening_cash ?? 0);

      const session = manager.create(CashRegisterSession, {
        warehouse_id: dto.warehouse_id,
        user_id: dto.user_id, // (aunque sea “por tienda”, guardas quién la abrió)
        opening_cash: Number(opening.toFixed(2)),
        status: 'OPEN',
        opened_at: new Date(),
        closed_at: null,
        closing_cash_counted: null,
        closing_expected_cash: null,
        difference: null,
        notes: null,
      });

      await manager.save(CashRegisterSession, session);

      return {
        message: 'Caja abierta correctamente',
        session,
      };
    });
  }

  /**
   * ✅ (Opcional pero útil) Ver caja abierta por warehouse
   */
  async getOpenSessionByWarehouse(warehouseId: number) {
    const session = await this.sessionRepo.findOne({
      where: { warehouse_id: warehouseId, status: 'OPEN' },
      order: { opened_at: 'DESC' as any },
    });

    return {
      open: !!session,
      session: session ?? null,
    };
  }
}
