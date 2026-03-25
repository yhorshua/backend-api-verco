import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, EntityManager } from 'typeorm';

import { CashRegisterSession } from '../database/entities/cash-register-session.entity';
import { CashMovement } from '../database/entities/cash-movement.entity';

import { OpenCashDto } from './dto/cash-open.dto';
import { ExpenseDto } from './dto/expense.dto';
import { CloseCashDto } from './dto/close-cash.dto';

type CashSummary = {
  session: CashRegisterSession;
  totalsByMethod: Record<string, number>;
  totalIncome: number;
  totalExpense: number;
  net: number;
  expectedCash: number;
};

@Injectable()
export class CashService {
  constructor(
    @InjectRepository(CashRegisterSession)
    private readonly sessionRepo: Repository<CashRegisterSession>,

    @InjectRepository(CashMovement)
    private readonly movementRepo: Repository<CashMovement>,

    private readonly dataSource: DataSource,
  ) {}

  // ======================================================
  // POST /cash/open
  // ======================================================
  async openCash(dto: OpenCashDto) {
    return this.dataSource.transaction(async (manager) => {
      // 🔒 evita carreras: revisa OPEN con FOR UPDATE
      const open = await manager.query(
        `SELECT id FROM CashRegisterSessions
         WHERE warehouse_id = ? AND status = 'OPEN'
         LIMIT 1 FOR UPDATE`,
        [dto.warehouse_id],
      );

      if (open.length) {
        throw new BadRequestException(`Ya existe una caja ABIERTA para warehouse_id=${dto.warehouse_id}`);
      }

      const session = manager.create(CashRegisterSession, {
        warehouse_id: dto.warehouse_id,
        user_id: dto.user_id,
        opening_cash: Number(dto.opening_amount.toFixed(2)),
        status: 'OPEN',
        notes: dto.notes?.trim() || null,
      });

      await manager.save(CashRegisterSession, session);

      // (opcional) registrar movimiento de apertura
      const mv = manager.create(CashMovement, {
        session_id: session.id,
        warehouse_id: dto.warehouse_id,
        user_id: dto.user_id,
        type: 'OPENING',
        payment_method: 'efectivo',
        amount: Number(dto.opening_amount.toFixed(2)),
        operation_number: null,
        reference_sale_id: null,
        reference_sale_payment_id: null,
        description: 'Apertura de caja',
      });
      await manager.save(CashMovement, mv);

      return { session };
    });
  }

  // ======================================================
  // GET /cash/status/:warehouseId
  // ======================================================
  async getStatus(warehouseId: number) {
    const session = await this.sessionRepo.findOne({
      where: { warehouse_id: warehouseId, status: 'OPEN' as any },
      order: { opened_at: 'DESC' as any },
    });

    return { session: session || null };
  }

  // ======================================================
  // GET /cash/movements/:sessionId
  // ======================================================
  async getMovementsAndSummary(sessionId: number) {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException(`No existe CashRegisterSession id=${sessionId}`);

    const movements = await this.movementRepo.find({
      where: { session_id: sessionId },
      order: { created_at: 'DESC' as any },
    });

    const summary = this.buildSummary(session, movements);

    return { movements, summary };
  }

  // ======================================================
  // POST /cash/expense
  // ======================================================
  async registerExpense(dto: ExpenseDto) {
    return this.dataSource.transaction(async (manager) => {
      const session = await this.requireOpenSession(manager, dto.session_id, dto.warehouse_id);

      const amount = Number(dto.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new BadRequestException('amount inválido para egreso');
      }

      const mv = manager.create(CashMovement, {
        session_id: session.id,
        warehouse_id: dto.warehouse_id,
        user_id: dto.user_id,

        type: 'EXPENSE',
        payment_method: 'efectivo', // por negocio: egreso sale de caja
        amount: -Math.abs(Number(amount.toFixed(2))),
        operation_number: null,

        reference_sale_id: null,
        reference_sale_payment_id: null,

        description: dto.description?.trim() || 'Egreso',
      });

      await manager.save(CashMovement, mv);
      return { ok: true };
    });
  }

  // ======================================================
  // POST /cash/close
  // ======================================================
  async closeCash(dto: CloseCashDto) {
    return this.dataSource.transaction(async (manager) => {
      const session = await this.requireOpenSession(manager, dto.session_id, dto.warehouse_id);

      const movements = await manager.find(CashMovement, {
        where: { session_id: session.id },
        order: { created_at: 'DESC' as any },
      });

      const summary = this.buildSummary(session, movements);

      const counted = Number(dto.closing_cash_counted);
      if (!Number.isFinite(counted) || counted < 0) {
        throw new BadRequestException('closing_cash_counted inválido');
      }

      session.closing_cash_counted = Number(counted.toFixed(2));
      session.closing_expected_cash = Number(summary.expectedCash.toFixed(2));
      session.difference = Number((session.closing_cash_counted - session.closing_expected_cash).toFixed(2));
      session.closed_at = new Date();
      session.status = 'CLOSED';
      session.notes = dto.notes?.trim() || session.notes || null;

      await manager.save(CashRegisterSession, session);

      // (opcional) movimiento de cierre
      const closeMv = manager.create(CashMovement, {
        session_id: session.id,
        warehouse_id: dto.warehouse_id,
        user_id: dto.user_id,

        type: 'CLOSING',
        payment_method: 'efectivo',
        amount: 0,
        operation_number: null,
        reference_sale_id: null,
        reference_sale_payment_id: null,
        description: `Cierre de caja. Conteo: S/ ${session.closing_cash_counted} | Esperado: S/ ${session.closing_expected_cash} | Dif: S/ ${session.difference}`,
      });

      await manager.save(CashMovement, closeMv);

      return { session };
    });
  }

  // ======================================================
  // Helpers
  // ======================================================
  private async requireOpenSession(manager: EntityManager, sessionId: number, warehouseId: number) {
    const rows = await manager.query(
      `SELECT * FROM CashRegisterSessions
       WHERE id = ? AND warehouse_id = ? AND status = 'OPEN'
       LIMIT 1 FOR UPDATE`,
      [sessionId, warehouseId],
    );

    if (!rows.length) {
      throw new BadRequestException(`No existe caja ABIERTA con session_id=${sessionId} para warehouse_id=${warehouseId}`);
    }

    // re-cargar como entity para guardar
    const session = await manager.findOne(CashRegisterSession, { where: { id: sessionId } });
    if (!session) throw new NotFoundException(`No existe CashRegisterSession id=${sessionId}`);

    if (session.status !== 'OPEN') {
      throw new BadRequestException(`La caja no está abierta. session_id=${sessionId}`);
    }

    return session;
  }

  private buildSummary(session: CashRegisterSession, movements: CashMovement[]): CashSummary {
    let totalIncome = 0;
    let totalExpense = 0;

    const totalsByMethod: Record<string, number> = {};

    for (const m of movements) {
      const amt = Number(m.amount || 0);
      const method = (m.payment_method || 'N/A').toString();

      // Totales por método (sumando ingresos - egresos)
      totalsByMethod[method] = Number(((totalsByMethod[method] || 0) + amt).toFixed(2));

      if (amt >= 0) totalIncome += amt;
      if (amt < 0) totalExpense += Math.abs(amt);
    }

    totalIncome = Number(totalIncome.toFixed(2));
    totalExpense = Number(totalExpense.toFixed(2));
    const net = Number((totalIncome - totalExpense).toFixed(2));

    // expectedCash: apertura + ingresos efectivo - egresos (asumidos en efectivo)
    const opening = Number(session.opening_cash || 0);

    const cashIn = movements
      .filter((m) => m.payment_method === 'efectivo' && Number(m.amount) > 0)
      .reduce((acc, m) => acc + Number(m.amount || 0), 0);

    const cashOut = movements
      .filter((m) => Number(m.amount) < 0) // egreso
      .reduce((acc, m) => acc + Math.abs(Number(m.amount || 0)), 0);

    const expectedCash = Number((opening + cashIn - cashOut).toFixed(2));

    return {
      session,
      totalsByMethod,
      totalIncome,
      totalExpense,
      net,
      expectedCash,
    };
  }
}
