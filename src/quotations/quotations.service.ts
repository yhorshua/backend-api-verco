import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { businessDateInPeru, toPeruIso, utcDatabaseDateTime } from '../utils/timezone.util';
import { CreateQuotationDto } from './dto/create-quotation.dto';

type Actor = { userId: number; role: string; warehouseId?: number | null };
const MANAGERS = new Set(['Administrador', 'Jefe Ventas']);
const SELLER_ROLES = new Set(['Administrador', 'Jefe Ventas', 'Vendedor', 'Vendedor Web', 'Tienda']);
const OPEN_STATUSES = ['ISSUED', 'PARTIALLY_USED'];

@Injectable()
export class QuotationsService {
  constructor(private readonly dataSource: DataSource) { }

  async create(dto: CreateQuotationDto, actor: Actor) {
    this.assertActor(actor);
    const actorId = Number(actor.userId);
    const manager = MANAGERS.has(actor.role);
    if (!manager && Number(dto.seller_id) !== actorId) {
      throw new ForbiddenException('No puedes emitir una cotización a nombre de otro vendedor');
    }
    if (!manager && Number(dto.warehouse_id) !== Number(actor.warehouseId)) {
      throw new ForbiddenException('No puedes cotizar inventario de otro almacén');
    }
    const keys = dto.items.map((item) => `${item.product_id}|${item.product_size_id}`);
    if (new Set(keys).size !== keys.length) {
      throw new BadRequestException('No se puede repetir el mismo producto y talla');
    }
    const now = new Date();
    const businessDate = businessDateInPeru(now);
    if (dto.expires_on && dto.expires_on < businessDate) {
      throw new BadRequestException('La fecha de vencimiento no puede estar en el pasado');
    }

    let quotationId = 0;
    try {
      quotationId = await this.dataSource.transaction(async (managerTx) => {
        const existing = await managerTx.query('SELECT id FROM Quotations WHERE idempotency_key = ? LIMIT 1', [dto.idempotency_key]);
        if (existing.length) return Number(existing[0].id);
        await this.validateParties(managerTx, dto, actor);

        let subtotalCents = 0;
        let discountCents = 0;
        let taxCents = 0;
        const lines: Array<Record<string, unknown>> = [];
        for (const item of dto.items) {
          const rows = await managerTx.query(
            `SELECT p.id, p.article_code, p.article_description, p.status,
                    ps.id product_size_id, ps.size,
                    s.quantity,
                    COALESCE((SELECT SUM(sr.quantity) FROM stock_reservations sr
                      WHERE sr.warehouse_id = s.warehouse_id AND sr.product_id = s.product_id
                        AND sr.product_size_id = s.product_size_id AND sr.status = 'RESERVADO'), 0) reserved_quantity
               FROM Products p
               JOIN ProductSize ps ON ps.product_id = p.id AND ps.id = ?
               JOIN Stock s ON s.product_id = p.id AND s.product_size_id = ps.id AND s.warehouse_id = ?
              WHERE p.id = ? AND p.status = 1 LIMIT 1`,
            [item.product_size_id, dto.warehouse_id, item.product_id],
          );
          if (!rows.length) throw new BadRequestException(`Producto o talla no disponible: ${item.product_id}/${item.product_size_id}`);
          const available = Number(rows[0].quantity) - Number(rows[0].reserved_quantity);
          if (available < item.quantity) throw new ConflictException(`Stock disponible insuficiente para ${rows[0].article_code}. Disponible: ${available}`);
          /*
          const requestedUnit = this.parseCents(item.unit_price, 'precio');
          const catalogUnit = this.parseCents(String(rows[0].factory_price), 'precio mayorista');
          if (!manager && requestedUnit !== catalogUnit) {
            throw new BadRequestException(
              `El precio de ${rows[0].article_code} cambió. Precio mayorista vigente: ${this.money(catalogUnit)}`,
            );
          }
          const unit = manager ? requestedUnit : catalogUnit;
          */
         const unit = this.parseCents(item.unit_price, 'precio');
          const base = unit * item.quantity;
          const discount = this.parseCents(item.discount_amount ?? '0.00', 'descuento');
          const tax = this.parseCents(item.tax_amount ?? '0.00', 'impuesto');
          if (discount > base) throw new BadRequestException('El descuento no puede superar el importe de la línea');
          const lineTotal = base - discount + tax;
          subtotalCents += base; discountCents += discount; taxCents += tax;
          lines.push({ ...item, sku: rows[0].article_code, description: rows[0].article_description, size: rows[0].size, unit, discount, tax, lineTotal });
        }
        const totalCents = subtotalCents - discountCents + taxCents;
        const year = Number(businessDate.slice(0, 4));
        const utc = utcDatabaseDateTime(now);
        await managerTx.query('INSERT INTO QuotationSequences (`year`, last_number, updated_at_utc) VALUES (?, 0, ?) ON DUPLICATE KEY UPDATE `year` = VALUES(`year`)', [year, utc]);
        const sequenceRows = await managerTx.query('SELECT last_number FROM QuotationSequences WHERE `year` = ? FOR UPDATE', [year]);
        const sequence = Number(sequenceRows[0].last_number) + 1;
        await managerTx.query('UPDATE QuotationSequences SET last_number = ?, updated_at_utc = ? WHERE `year` = ?', [sequence, utc, year]);
        const quoteNumber = `CO-${year}-${String(sequence).padStart(6, '0')}`;
        const insert = await managerTx.query(
          `INSERT INTO Quotations
            (quote_number,idempotency_key,quote_year,sequence_number,client_id,seller_id,warehouse_id,currency,
             issued_at_utc,issued_at_lima,business_date,expires_on,subtotal,discount_total,tax_total,total,status,
             observations,created_by,version)
           VALUES (?,?,?,?,?,?,?,'PEN',?,?,?,?,?,?,?,?,'ISSUED',?,?,1)`,
          [quoteNumber, dto.idempotency_key, year, sequence, dto.client_id, dto.seller_id, dto.warehouse_id, utc, toPeruIso(now), businessDate, dto.expires_on ?? null, this.money(subtotalCents), this.money(discountCents), this.money(taxCents), this.money(totalCents), this.clean(dto.observations, 500), actorId],
        );
        const id = Number(insert.insertId);
        for (const line of lines) {
          await managerTx.query(
            `INSERT INTO QuotationDetails
              (quotation_id,product_id,product_size_id,sku_snapshot,description_snapshot,size_snapshot,quantity,
               used_quantity,unit_price,discount_amount,tax_amount,line_total,created_at_utc)
             VALUES (?,?,?,?,?,?,?,0,?,?,?,?,?)`,
            [id, line.product_id, line.product_size_id, line.sku, line.description, line.size, line.quantity, this.money(line.unit as number), this.money(line.discount as number), this.money(line.tax as number), this.money(line.lineTotal as number), utc],
          );
        }
        await this.history(managerTx, id, 'CREATED', null, 'ISSUED', actorId, 'Cotización emitida', now);
        return id;
      });
    } catch (error: any) {
      if (error?.code === 'ER_DUP_ENTRY') {
        const existing = await this.dataSource.query('SELECT id FROM Quotations WHERE idempotency_key = ? LIMIT 1', [dto.idempotency_key]);
        if (existing.length) quotationId = Number(existing[0].id);
        else throw new ConflictException('No se pudo asignar un correlativo único; vuelve a intentar');
      } else throw error;
    }
    return this.getById(quotationId, actor);
  }

  async list(query: Record<string, string>, actor: Actor) {
    this.assertActor(actor);
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const params: unknown[] = [];
    const where = ['1=1'];
    const manager = MANAGERS.has(actor.role);
    if (manager && query.seller_id) {
      where.push('q.seller_id = ?'); params.push(Number(query.seller_id));
    } else if (!manager) {
      where.push('q.seller_id = ?'); params.push(Number(actor.userId));
    }
    if (query.client_id) { where.push('q.client_id = ?'); params.push(Number(query.client_id)); }
    if (query.status === 'EXPIRED') {
      where.push(`(q.status = 'EXPIRED' OR (q.status IN ('ISSUED','PARTIALLY_USED') AND q.expires_on < ?))`);
      params.push(businessDateInPeru());
    } else if (query.status) {
      where.push('q.status = ?'); params.push(query.status);
      if (OPEN_STATUSES.includes(query.status)) {
        where.push('(q.expires_on IS NULL OR q.expires_on >= ?)'); params.push(businessDateInPeru());
      }
    }
    if (query.search?.trim()) {
      const term = `%${query.search.trim().slice(0, 100)}%`;
      where.push('(q.quote_number LIKE ? OR c.business_name LIKE ? OR c.document_number LIKE ?)');
      params.push(term, term, term);
    }
    if (query.available === 'true') {
      where.push(`q.status IN ('ISSUED','PARTIALLY_USED')`);
      where.push('(q.expires_on IS NULL OR q.expires_on >= ?)'); params.push(businessDateInPeru());
    }
    if (query.from) { where.push('q.business_date >= ?'); params.push(query.from); }
    if (query.to) { where.push('q.business_date <= ?'); params.push(query.to); }
    const base = `FROM Quotations q JOIN Clients c ON c.id=q.client_id JOIN Users u ON u.id=q.seller_id
      WHERE ${where.join(' AND ')}`;
    const sortColumns: Record<string, string> = {
      number: 'q.quote_number',
      date: 'q.issued_at_utc',
      expiry: 'q.expires_on',
      total: 'q.total',
      status: 'q.status',
    };
    const sortColumn = sortColumns[query.sort_by] ?? 'q.issued_at_utc';
    const sortDirection = query.sort_direction?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const rows = await this.dataSource.query(
      `SELECT q.*,c.business_name client_name,c.document_number,u.full_name seller_name,
              CASE WHEN q.status IN ('ISSUED','PARTIALLY_USED') AND q.expires_on < ? THEN 'EXPIRED' ELSE q.status END effective_status,
              (SELECT COALESCE(SUM(d.quantity-d.used_quantity),0) FROM QuotationDetails d WHERE d.quotation_id=q.id) remaining_quantity
         ${base} ORDER BY ${sortColumn} ${sortDirection} LIMIT ? OFFSET ?`, [businessDateInPeru(), ...params, limit, (page - 1) * limit]);
    const count = await this.dataSource.query(`SELECT COUNT(*) total ${base}`, params);
    return { data: rows, pagination: { page, limit, total: Number(count[0].total), totalPages: Math.ceil(Number(count[0].total) / limit) } };
  }

  async getById(id: number, actor: Actor) {
    this.assertActor(actor);
    if (!Number.isInteger(id) || id < 1) throw new BadRequestException('Cotización inválida');
    const headers = await this.dataSource.query(
      `SELECT q.*,c.business_name client_name,c.document_type,c.document_number,c.phone client_phone,c.email client_email,
              c.address client_address,u.full_name seller_name,w.warehouse_name
         FROM Quotations q JOIN Clients c ON c.id=q.client_id JOIN Users u ON u.id=q.seller_id
         JOIN Warehouses w ON w.id=q.warehouse_id WHERE q.id=? LIMIT 1`, [id]);
    if (!headers.length) throw new NotFoundException('Cotización no encontrada');
    if (!MANAGERS.has(actor.role) && Number(headers[0].seller_id) !== Number(actor.userId)) throw new ForbiddenException('No tienes acceso a esta cotización');
    const details = await this.dataSource.query(
      `SELECT d.*,d.quantity-d.used_quantity remaining_quantity FROM QuotationDetails d WHERE d.quotation_id=? ORDER BY d.id`, [id]);
    const history = await this.dataSource.query(
      `SELECT h.*,u.full_name user_name FROM QuotationHistory h JOIN Users u ON u.id=h.user_id WHERE h.quotation_id=? ORDER BY h.id`, [id]);
    return { quotation: headers[0], details, history };
  }

  async cancel(id: number, reason: string, actor: Actor) {
    const cleanReason = this.clean(reason, 255);
    if (!cleanReason || cleanReason.length < 3) throw new BadRequestException('El motivo de anulación es obligatorio');
    await this.dataSource.transaction(async (manager) => {
      const rows = await manager.query('SELECT * FROM Quotations WHERE id=? FOR UPDATE', [id]);
      if (!rows.length) throw new NotFoundException('Cotización no encontrada');
      const quote = rows[0];
      if (!MANAGERS.has(actor.role) && Number(quote.seller_id) !== Number(actor.userId)) throw new ForbiddenException('No puedes anular esta cotización');
      if (!OPEN_STATUSES.includes(quote.status)) throw new ConflictException('La cotización ya no puede anularse');
      const used = await manager.query('SELECT COALESCE(SUM(used_quantity),0) used FROM QuotationDetails WHERE quotation_id=?', [id]);
      if (Number(used[0].used) > 0) throw new ConflictException('No se puede anular una cotización que ya fue utilizada');
      const now = new Date();
      await manager.query(`UPDATE Quotations SET status='CANCELLED',cancelled_by=?,cancelled_at_utc=?,cancellation_reason=?,updated_by=?,updated_at_utc=?,version=version+1 WHERE id=?`, [actor.userId, utcDatabaseDateTime(now), cleanReason, actor.userId, utcDatabaseDateTime(now), id]);
      await this.history(manager, id, 'CANCELLED', quote.status, 'CANCELLED', Number(actor.userId), cleanReason, now);
    });
    return this.getById(id, actor);
  }

  async report(query: Record<string, string>, actor: Actor) {
    const where = ['1=1']; const params: unknown[] = [];
    if (query.from) { where.push('q.business_date>=?'); params.push(query.from); }
    if (query.to) { where.push('q.business_date<=?'); params.push(query.to); }
    if (query.seller_id) { where.push('q.seller_id=?'); params.push(Number(query.seller_id)); }
    return this.dataSource.query(`SELECT q.status,COUNT(*) quotation_count,SUM(q.total) total_amount,
      SUM(CASE WHEN q.status IN ('PARTIALLY_USED','USED') THEN 1 ELSE 0 END) converted_count
      FROM Quotations q WHERE ${where.join(' AND ')} GROUP BY q.status ORDER BY q.status`, params);
  }

  private async validateParties(manager: EntityManager, dto: CreateQuotationDto, actor: Actor) {
    const sellers = await manager.query(`SELECT u.id,r.name_role FROM Users u JOIN Roles r ON r.id=u.rol_id WHERE u.id=? AND u.state_user=1 LIMIT 1`, [dto.seller_id]);
    if (!sellers.length || !SELLER_ROLES.has(sellers[0].name_role)) throw new BadRequestException('Vendedor inexistente o inactivo');
    const warehouses = await manager.query('SELECT id FROM Warehouses WHERE id=? AND status=1 LIMIT 1', [dto.warehouse_id]);
    if (!warehouses.length) throw new BadRequestException('Almacén inexistente o inactivo');
    const clients = await manager.query('SELECT id,seller_id FROM Clients WHERE id=? LIMIT 1', [dto.client_id]);
    if (!clients.length) throw new BadRequestException('Cliente inexistente');
    if (clients[0].seller_id != null && Number(clients[0].seller_id) !== Number(dto.seller_id)) throw new ForbiddenException('El cliente pertenece a otro vendedor');
  }
  private async history(manager: EntityManager, id: number, action: string, previous: string | null, next: string, userId: number, notes: string | null, now: Date) {
    await manager.query(`INSERT INTO QuotationHistory (quotation_id,action,previous_status,new_status,user_id,notes,occurred_at_utc,occurred_at_lima) VALUES (?,?,?,?,?,?,?,?)`, [id, action, previous, next, userId, notes, utcDatabaseDateTime(now), toPeruIso(now)]);
  }
  private assertActor(actor: Actor) { if (!Number.isInteger(Number(actor?.userId)) || !SELLER_ROLES.has(actor?.role)) throw new ForbiddenException('Usuario no autorizado'); }
  private parseCents(value: string, label: string) { const text = String(value ?? '').trim(); if (!/^\d{1,10}(\.\d{1,2})?$/.test(text)) throw new BadRequestException(`${label} inválido`); const [whole, dec = ''] = text.split('.'); return Number(whole) * 100 + Number(dec.padEnd(2, '0')); }
  private money(cents: number) { return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`; }
  private clean(value: unknown, max: number) { const text = String(value ?? '').trim(); return text ? text.slice(0, max) : null; }
}
