import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import moment from 'moment-timezone';
import { businessDateInPeru, utcDatabaseDateTime } from '../utils/timezone.util';
import { ListPendingPaymentsDto } from './dto/list-pending-payments.dto';
import { RegisterCreditPaymentDto } from './dto/register-credit-payment.dto';

export type PaymentUser = {
  userId: number;
  role: string;
  warehouseId: number | null;
};

@Injectable()
export class PendingPaymentsService {
  constructor(private readonly dataSource: DataSource) {}

  async list(query: ListPendingPaymentsDto, user: PaymentUser) {
    const businessDate = businessDateInPeru();
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;
    const { conditions, params } = this.buildListWhere(query, user);
    const where = conditions.join(' AND ');

    const sortColumns: Record<string, string> = {
      sale_code: 's.sale_code',
      sale_date: 's.sale_date',
      customer: 'customer_name',
      total_amount: 's.total_amount',
      amount_paid: '(s.total_amount - s.monto_restante)',
      monto_restante: 's.monto_restante',
      fecha_proximo_pago: 's.fecha_proximo_pago',
      status: 'payment_state',
    };
    const sortColumn = sortColumns[query.sortBy ?? 'fecha_proximo_pago'];
    const sortDirection = String(query.sortDir).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const [rows, countRows] = await Promise.all([
      this.dataSource.query(
        `SELECT
          s.id,
          s.sale_code,
          DATE_FORMAT(s.sale_date, '%Y-%m-%d %H:%i:%s') AS sale_date,
          s.customer_id,
          COALESCE(c.business_name, c.trade_name, 'Sin cliente') AS customer_name,
          CAST(s.total_amount AS CHAR) AS total_amount,
          CAST(s.monto_adelanto AS CHAR) AS monto_adelanto,
          CAST((s.total_amount - s.monto_restante) AS CHAR) AS amount_paid,
          CAST(s.monto_restante AS CHAR) AS monto_restante,
          DATE_FORMAT(s.fecha_proximo_pago, '%Y-%m-%d') AS fecha_proximo_pago,
          DATEDIFF(
            s.fecha_proximo_pago,
            clock.business_date
          ) AS days_remaining,
          CASE
            WHEN s.payment_status = 'PAID' OR s.monto_restante <= 0 THEN 'cancelado'
            WHEN s.fecha_proximo_pago < clock.business_date THEN 'vencido'
            WHEN s.fecha_proximo_pago = clock.business_date THEN 'vence_hoy'
            ELSE 'pendiente'
          END AS payment_state
        FROM Sales s
        LEFT JOIN Clients c ON c.id = s.customer_id
        CROSS JOIN (SELECT CAST(? AS DATE) AS business_date) clock
        WHERE ${where}
        ORDER BY ${sortColumn} ${sortDirection}, s.id DESC
        LIMIT ? OFFSET ?`,
        [businessDate, ...params, limit, offset],
      ),
      this.dataSource.query(
        `SELECT COUNT(*) AS total
         FROM Sales s
         LEFT JOIN Clients c ON c.id = s.customer_id
         CROSS JOIN (SELECT CAST(? AS DATE) AS business_date) clock
         WHERE ${where}`,
        [businessDate, ...params],
      ),
    ]);

    const total = Number(countRows[0]?.total ?? 0);
    return {
      data: rows.map((row: any) => ({
        ...row,
        days_remaining: row.days_remaining == null ? null : Number(row.days_remaining),
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async count(user: PaymentUser) {
    const params: unknown[] = [];
    const conditions = [
      `s.payment_method = 'credito'`,
      `s.payment_status = 'PENDING'`,
      `s.monto_restante > 0`,
    ];
    if (user.role !== 'Administrador') {
      if (!user.warehouseId) {
        throw new ForbiddenException('El usuario no tiene un almacén asignado');
      }
      conditions.push('s.warehouse_id = ?');
      params.push(user.warehouseId);
    }
    const rows = await this.dataSource.query(
      `SELECT COUNT(DISTINCT s.id) AS pending_credits
       FROM Sales s WHERE ${conditions.join(' AND ')}`,
      params,
    );
    return {
      pendingCredits: Number(rows[0]?.pending_credits ?? 0),
      definition: 'credit_sales_with_pending_balance',
      businessDate: businessDateInPeru(),
      timeZone: 'America/Lima',
    };
  }

  async detail(saleId: number, user: PaymentUser) {
    const sale = await this.findSaleSnapshot(this.dataSource, saleId);
    if (!sale) throw new NotFoundException('Venta a crédito no encontrada');
    this.assertSaleAccess(sale, user);

    const [items, payments] = await Promise.all([
      this.dataSource.query(
        `SELECT
          sd.id,
          p.article_code,
          p.article_description,
          ps.size,
          CAST(sd.quantity AS CHAR) AS quantity,
          CAST(sd.unit_price AS CHAR) AS unit_price,
          CAST((sd.quantity * sd.unit_price) AS CHAR) AS line_total
         FROM SaleDetails sd
         INNER JOIN Products p ON p.id = sd.product_id
         LEFT JOIN ProductSize ps ON ps.id = sd.product_size_id
         WHERE sd.sale_id = ?
         ORDER BY sd.id ASC`,
        [saleId],
      ),
      this.dataSource.query(
        `SELECT
          sp.id,
          CAST(sp.amount AS CHAR) AS amount,
          sp.method,
          DATE_FORMAT(sp.payment_date, '%Y-%m-%d') AS payment_date,
          sp.operation_number,
          sp.notes,
          sp.registered_by_user_id,
          u.full_name AS registered_by,
          CONCAT(DATE_FORMAT(sp.created_at, '%Y-%m-%dT%H:%i:%s'), 'Z') AS created_at
         FROM SalePayments sp
         LEFT JOIN Users u ON u.id = sp.registered_by_user_id
         WHERE sp.sale_id = ?
         ORDER BY sp.payment_date DESC, sp.id DESC`,
        [saleId],
      ),
    ]);

    return {
      sale,
      items,
      payments: payments.map((payment: any) => ({
        ...payment,
        payment_date: payment.payment_date || businessDateInPeru(new Date(payment.created_at)),
      })),
    };
  }

  async registerPayment(
    saleId: number,
    dto: RegisterCreditPaymentDto,
    user: PaymentUser,
  ) {
    const paymentCents = this.moneyToCents(dto.amount);
    if (paymentCents <= 0n) {
      throw new BadRequestException('El importe del pago debe ser mayor que cero');
    }

    const today = businessDateInPeru();
    this.assertCalendarDate(dto.payment_date, 'payment_date');
    if (dto.payment_date > today) {
      throw new BadRequestException('La fecha de pago no puede ser futura');
    }
    if (dto.next_payment_date) {
      this.assertCalendarDate(dto.next_payment_date, 'next_payment_date');
    }

    return this.dataSource.transaction(async (manager) => {
      const lockedRows = await manager.query(
        `SELECT id, sale_code, warehouse_id, payment_method,
                CAST(total_amount AS CHAR) AS total_amount,
                CAST(monto_adelanto AS CHAR) AS monto_adelanto,
                CAST(monto_restante AS CHAR) AS monto_restante,
                payment_status,
                DATE_FORMAT(fecha_proximo_pago, '%Y-%m-%d') AS fecha_proximo_pago
         FROM Sales
         WHERE id = ? AND payment_method = 'credito'
         LIMIT 1 FOR UPDATE`,
        [saleId],
      );
      const sale = lockedRows[0];
      if (!sale) throw new NotFoundException('Venta a crédito no encontrada');
      this.assertSaleAccess(sale, user);

      const duplicateRows = await manager.query(
        `SELECT id, sale_id, CAST(amount AS CHAR) AS amount, method,
                DATE_FORMAT(payment_date, '%Y-%m-%d') AS payment_date,
                operation_number, registered_by_user_id,
                CONCAT(DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s'), 'Z') AS created_at
         FROM SalePayments
         WHERE idempotency_key = ? LIMIT 1`,
        [dto.idempotency_key],
      );
      if (duplicateRows.length) {
        const duplicate = duplicateRows[0];
        const sameRequest =
          Number(duplicate.sale_id) === saleId &&
          Number(duplicate.registered_by_user_id) === Number(user.userId) &&
          duplicate.method === dto.method &&
          duplicate.payment_date === dto.payment_date &&
          this.moneyToCents(String(duplicate.amount)) === paymentCents;
        if (!sameRequest) {
          throw new ConflictException(
            'La clave de la solicitud ya fue utilizada para otro pago',
          );
        }
        return {
          message: 'El pago ya había sido registrado',
          duplicate: true,
          payment: duplicate,
          sale: await this.findSaleSnapshot(manager, saleId),
        };
      }

      const balanceCents = this.moneyToCents(String(sale.monto_restante));
      if (sale.payment_status === 'PAID' || balanceCents <= 0n) {
        throw new BadRequestException('La venta ya se encuentra cancelada');
      }
      if (paymentCents > balanceCents) {
        throw new BadRequestException('El importe no puede superar el saldo pendiente');
      }

      const remainingCents = balanceCents - paymentCents;
      if (remainingCents > 0n) {
        if (!dto.next_payment_date) {
          throw new BadRequestException(
            'La próxima fecha de pago es obligatoria cuando queda saldo pendiente',
          );
        }
        if (dto.next_payment_date <= dto.payment_date) {
          throw new BadRequestException(
            'La próxima fecha de pago debe ser posterior a la fecha del pago',
          );
        }
      }

      const operationNumber = dto.operation_number?.trim() || null;
      if (dto.method !== 'efectivo' && (!operationNumber || operationNumber.length < 6)) {
        throw new BadRequestException(
          'El número de operación debe tener al menos 6 caracteres',
        );
      }

      const sessionRows = await manager.query(
        `SELECT id
         FROM CashRegisterSessions
         WHERE warehouse_id = ? AND user_id = ? AND status = 'OPEN'
         ORDER BY opened_at DESC
         LIMIT 1 FOR UPDATE`,
        [sale.warehouse_id, user.userId],
      );
      if (!sessionRows.length) {
        throw new BadRequestException(
          'Debes abrir caja antes de registrar el pago',
        );
      }

      const amount = this.centsToMoney(paymentCents);
      const remaining = this.centsToMoney(remainingCents);
      const paymentStatus = remainingCents === 0n ? 'PAID' : 'PENDING';
      const nextPaymentDate = remainingCents === 0n ? null : dto.next_payment_date!;
      const createdAtUtc = utcDatabaseDateTime();

      const insertResult = await manager.query(
        `INSERT INTO SalePayments
          (sale_id, method, amount, payment_date, registered_by_user_id,
           idempotency_key, operation_number, cash_received, cash_change,
           notes, created_at)
         VALUES (?, ?, CAST(? AS DECIMAL(10,2)), ?, ?, ?, ?,
                 CAST(? AS DECIMAL(10,2)), CAST(? AS DECIMAL(10,2)), ?, ?)`,
        [
          saleId,
          dto.method,
          amount,
          dto.payment_date,
          user.userId,
          dto.idempotency_key,
          operationNumber,
          dto.method === 'efectivo' ? amount : null,
          dto.method === 'efectivo' ? '0.00' : null,
          dto.notes?.trim() || 'Pago de venta a crédito',
          createdAtUtc,
        ],
      );
      const paymentId = Number(insertResult.insertId);

      await manager.query(
        `UPDATE Sales
         SET monto_restante = CAST(? AS DECIMAL(10,2)),
             payment_status = ?,
             fecha_proximo_pago = ?
         WHERE id = ?`,
        [remaining, paymentStatus, nextPaymentDate, saleId],
      );

      await manager.query(
        `INSERT INTO CashMovements
          (session_id, warehouse_id, user_id, type, payment_method, amount,
           operation_number, reference_sale_id, reference_sale_payment_id,
           description, created_at)
         VALUES (?, ?, ?, 'CREDIT_PAYMENT', ?, CAST(? AS DECIMAL(10,2)),
                 ?, ?, ?, ?, ?)`,
        [
          sessionRows[0].id,
          sale.warehouse_id,
          user.userId,
          dto.method,
          amount,
          operationNumber,
          saleId,
          paymentId,
          `Pago crédito venta ${sale.sale_code}`,
          createdAtUtc,
        ],
      );

      return {
        message: remainingCents === 0n
          ? 'Pago registrado. La venta quedó cancelada.'
          : 'Pago registrado correctamente.',
        duplicate: false,
        payment: {
          id: paymentId,
          amount,
          method: dto.method,
          payment_date: dto.payment_date,
          operation_number: operationNumber,
          registered_by_user_id: user.userId,
        },
        sale: await this.findSaleSnapshot(manager, saleId),
      };
    });
  }

  private buildListWhere(query: ListPendingPaymentsDto, user: PaymentUser) {
    const conditions = [`s.payment_method = 'credito'`];
    const params: unknown[] = [];

    if (user.role !== 'Administrador') {
      if (!user.warehouseId) {
        throw new ForbiddenException('El usuario no tiene un almacén asignado');
      }
      conditions.push('s.warehouse_id = ?');
      params.push(user.warehouseId);
    } else if (query.warehouseId) {
      conditions.push('s.warehouse_id = ?');
      params.push(query.warehouseId);
    }

    const status = query.status ?? 'all';
    if (status === 'paid') {
      conditions.push(`(s.payment_status = 'PAID' OR s.monto_restante <= 0)`);
    } else {
      conditions.push(`s.payment_status = 'PENDING' AND s.monto_restante > 0`);
      if (status === 'pending') {
        conditions.push(`(
          s.fecha_proximo_pago IS NULL OR
          s.fecha_proximo_pago > clock.business_date
        )`);
      } else if (status === 'due_today') {
        conditions.push(`s.fecha_proximo_pago = clock.business_date`);
      } else if (status === 'overdue') {
        conditions.push(`s.fecha_proximo_pago < clock.business_date`);
      }
    }

    const search = query.search?.trim();
    if (search) {
      conditions.push(`(
        s.sale_code LIKE ? OR c.business_name LIKE ? OR c.trade_name LIKE ?
        OR c.document_number LIKE ?
      )`);
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }
    if (query.from) {
      conditions.push('s.fecha_proximo_pago >= ?');
      params.push(query.from);
    }
    if (query.to) {
      conditions.push('s.fecha_proximo_pago <= ?');
      params.push(query.to);
    }
    if (query.from && query.to && query.from > query.to) {
      throw new BadRequestException('La fecha inicial no puede superar la fecha final');
    }
    return { conditions, params };
  }

  private async findSaleSnapshot(
    executor: Pick<DataSource | EntityManager, 'query'>,
    saleId: number,
  ) {
    const businessDate = businessDateInPeru();
    const rows = await executor.query(
      `SELECT
        s.id,
        s.sale_code,
        s.warehouse_id,
        s.user_id,
        s.customer_id,
        DATE_FORMAT(s.sale_date, '%Y-%m-%d %H:%i:%s') AS sale_date,
        COALESCE(c.business_name, c.trade_name, 'Sin cliente') AS customer_name,
        CAST(s.total_amount AS CHAR) AS total_amount,
        CAST(s.monto_adelanto AS CHAR) AS monto_adelanto,
        CAST((s.total_amount - s.monto_restante) AS CHAR) AS amount_paid,
        CAST(s.monto_restante AS CHAR) AS monto_restante,
        s.metodo_pago_adelanto,
        DATE_FORMAT(s.fecha_proximo_pago, '%Y-%m-%d') AS fecha_proximo_pago,
        DATEDIFF(
          s.fecha_proximo_pago,
          clock.business_date
        ) AS days_remaining,
        s.payment_status,
        CASE
          WHEN s.payment_status = 'PAID' OR s.monto_restante <= 0 THEN 'cancelado'
          WHEN s.fecha_proximo_pago < clock.business_date THEN 'vencido'
          WHEN s.fecha_proximo_pago = clock.business_date THEN 'vence_hoy'
          ELSE 'pendiente'
        END AS payment_state
       FROM Sales s
       LEFT JOIN Clients c ON c.id = s.customer_id
       CROSS JOIN (SELECT CAST(? AS DATE) AS business_date) clock
       WHERE s.id = ? AND s.payment_method = 'credito'
       LIMIT 1`,
      [businessDate, saleId],
    );
    if (!rows[0]) return null;
    return {
      ...rows[0],
      days_remaining: rows[0].days_remaining == null
        ? null
        : Number(rows[0].days_remaining),
    };
  }

  private assertSaleAccess(sale: { warehouse_id: number }, user: PaymentUser) {
    if (user.role !== 'Administrador' && Number(sale.warehouse_id) !== Number(user.warehouseId)) {
      throw new ForbiddenException('No tienes permisos para consultar esta venta');
    }
  }

  private moneyToCents(value: string): bigint {
    const normalized = String(value).trim();
    if (!/^\d{1,8}(\.\d{1,2})?$/.test(normalized)) {
      throw new BadRequestException(
        'El importe debe ser un número positivo con máximo dos decimales',
      );
    }
    const [whole, decimal = ''] = normalized.split('.');
    return BigInt(whole) * 100n + BigInt(decimal.padEnd(2, '0'));
  }

  private centsToMoney(cents: bigint): string {
    const whole = cents / 100n;
    const decimal = String(cents % 100n).padStart(2, '0');
    return `${whole}.${decimal}`;
  }

  private assertCalendarDate(value: string, field: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !moment(value, 'YYYY-MM-DD', true).isValid()) {
      throw new BadRequestException(`${field} debe ser una fecha válida en formato YYYY-MM-DD`);
    }
  }
}
