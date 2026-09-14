import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import {
  businessDateInPeru,
  toPeruIso,
  utcDatabaseDateTime,
} from '../utils/timezone.util';
import { CreateInventoryAdjustmentDto } from './dto/create-inventory-adjustment.dto';
import { InventoryAdjustmentReason } from './dto/inventory-adjustment-reason.enum';

export type AdjustmentUser = {
  userId: number;
  role: string;
  warehouseId: number | null;
};

type RequestMetadata = { correlationId?: string; ip?: string };

const ALLOWED_ROLES = new Set(['Administrador', 'Jefe Ventas']);

@Injectable()
export class InventoryAdjustmentsService {
  constructor(private readonly dataSource: DataSource) {}

  async listAllowedWarehouses(user: AdjustmentUser) {
    this.assertRole(user);
    const rows = await this.dataSource.query(
      `SELECT id, warehouse_name, type, location
       FROM Warehouses
       WHERE status = 1
       ORDER BY warehouse_name ASC`,
    );
    return rows.map((row: any) => ({ ...row, id: Number(row.id) }));
  }

  async getWarehouseInventory(warehouseId: number, user: AdjustmentUser) {
    this.assertRole(user);
    const warehouse = await this.findActiveWarehouse(this.dataSource, warehouseId);

    const rows = await this.dataSource.query(
      `SELECT
         s.id AS stock_id,
         s.warehouse_id,
         s.product_id,
         s.product_size_id,
         s.quantity AS stock_current,
         s.unit_of_measure,
         s.version,
         CASE WHEN s.updated_at_utc IS NULL THEN NULL
              ELSE CONCAT(DATE_FORMAT(s.updated_at_utc, '%Y-%m-%dT%H:%i:%s.'),
                          LPAD(FLOOR(MICROSECOND(s.updated_at_utc) / 1000), 3, '0'), 'Z')
          END AS last_modified_utc,
         p.article_code AS sku,
         NULL AS barcode,
         p.article_description AS description,
         p.brand_name,
         p.model_code,
         p.color,
         p.category_id,
         c.name AS category_name,
         CAST(p.status AS UNSIGNED) AS product_active,
         ps.size,
         COALESCE(r.reserved_quantity, 0) AS stock_reserved
       FROM Stock s
       INNER JOIN Products p ON p.id = s.product_id
       LEFT JOIN ProductSize ps ON ps.id = s.product_size_id
       LEFT JOIN Categories c ON c.id = p.category_id
       LEFT JOIN (
         SELECT warehouse_id, product_id, product_size_id, SUM(quantity) AS reserved_quantity
         FROM stock_reservations
         WHERE status = 'RESERVADO'
         GROUP BY warehouse_id, product_id, product_size_id
       ) r ON r.warehouse_id = s.warehouse_id
          AND r.product_id = s.product_id
          AND r.product_size_id <=> s.product_size_id
       WHERE s.warehouse_id = ? AND p.status = 1
       ORDER BY p.article_code ASC, CAST(ps.size AS UNSIGNED) ASC, ps.size ASC`,
      [warehouseId],
    );

    return {
      warehouse,
      items: rows.map((row: any) => {
        const stockCurrent = Number(row.stock_current);
        const stockReserved = Number(row.stock_reserved);
        return {
          ...row,
          stock_id: Number(row.stock_id),
          warehouse_id: Number(row.warehouse_id),
          product_id: Number(row.product_id),
          product_size_id: Number(row.product_size_id),
          category_id: row.category_id == null ? null : Number(row.category_id),
          stock_current: stockCurrent,
          stock_reserved: stockReserved,
          stock_available: stockCurrent - stockReserved,
          version: Number(row.version),
          product_active: Boolean(Number(row.product_active)),
        };
      }),
      snapshot: {
        captured_at_utc: new Date().toISOString(),
        captured_at_lima: toPeruIso(),
        item_count: rows.length,
      },
    };
  }

  async create(
    dto: CreateInventoryAdjustmentDto,
    user: AdjustmentUser,
    metadata: RequestMetadata = {},
  ) {
    this.assertRole(user);
    if (!Array.isArray(dto.items) || dto.items.length === 0) {
      throw new BadRequestException('Debe enviar al menos una fila modificada');
    }
    for (const item of dto.items) {
      if (
        !Number.isInteger(item.stock_id) || item.stock_id < 1 ||
        !Number.isInteger(item.product_id) || item.product_id < 1 ||
        (item.product_size_id !== null && (!Number.isInteger(item.product_size_id) || item.product_size_id < 1)) ||
        !Number.isInteger(item.observed_quantity) || item.observed_quantity < 0 ||
        !Number.isInteger(item.new_quantity) || item.new_quantity < 0 ||
        !Number.isInteger(item.observed_version) || item.observed_version < 1
      ) {
        throw new BadRequestException('Los identificadores, cantidades y versiones del ajuste son inválidos');
      }
    }
    const observation = dto.observation?.trim() || null;
    if (dto.reason === InventoryAdjustmentReason.OTHER && (!observation || observation.length < 10)) {
      throw new BadRequestException(
        'La observación debe tener al menos 10 caracteres cuando el motivo es Otro',
      );
    }

    const duplicateStockIds = this.findDuplicates(dto.items.map((item) => item.stock_id));
    if (duplicateStockIds.length) {
      throw new BadRequestException({
        message: 'La solicitud contiene filas de stock duplicadas',
        stock_ids: duplicateStockIds,
      });
    }

    const canonicalItems = [...dto.items].sort((a, b) => a.stock_id - b.stock_id);
    const requestHash = createHash('sha256').update(JSON.stringify({
      warehouse_id: dto.warehouse_id,
      reason: dto.reason,
      observation,
      items: canonicalItems,
    })).digest('hex');
    const now = new Date();
    const occurredAtUtc = utcDatabaseDateTime(now);
    const occurredAtLima = toPeruIso(now);
    const businessDate = businessDateInPeru(now);
    const correlationId = this.cleanCorrelationId(metadata.correlationId);
    const requestIp = this.cleanIp(metadata.ip);
    const operationCode = `AJS-${businessDate.replaceAll('-', '')}-${dto.idempotency_key.slice(0, 8).toUpperCase()}`;

    return this.dataSource.transaction(async (manager) => {
      const actor = await this.findActiveActor(manager, user);
      const warehouse = await this.findActiveWarehouse(manager, dto.warehouse_id);

      const insertOperation = await manager.query(
        `INSERT IGNORE INTO InventoryAdjustmentOperations
          (operation_code, idempotency_key, request_hash, warehouse_id, user_id,
           user_name_snapshot, role_snapshot, reason_code, observation,
           correlation_id, request_ip, status, item_count, occurred_at_utc,
           occurred_at_lima, business_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'APPLIED', ?, ?, ?, ?)`,
        [
          operationCode,
          dto.idempotency_key,
          requestHash,
          dto.warehouse_id,
          user.userId,
          actor.full_name,
          actor.role,
          dto.reason,
          observation,
          correlationId,
          requestIp,
          dto.items.length,
          occurredAtUtc,
          occurredAtLima,
          businessDate,
        ],
      );

      if (Number(insertOperation.affectedRows) === 0) {
        const existing = await manager.query(
          `SELECT id, request_hash, user_id FROM InventoryAdjustmentOperations
           WHERE idempotency_key = ? LIMIT 1`,
          [dto.idempotency_key],
        );
        if (!existing[0] || existing[0].request_hash !== requestHash || Number(existing[0].user_id) !== user.userId) {
          throw new ConflictException('La clave idempotente ya pertenece a otra operación');
        }
        return {
          ...(await this.getOperationWith(manager, Number(existing[0].id))),
          duplicate: true,
        };
      }

      const operationId = Number(insertOperation.insertId);
      const placeholders = canonicalItems.map(() => '?').join(',');
      const lockedRows = await manager.query(
        `SELECT s.id AS stock_id, s.warehouse_id, s.product_id, s.product_size_id,
                s.quantity, s.unit_of_measure, s.version,
                p.article_code AS sku, p.article_description AS description,
                CAST(p.status AS UNSIGNED) AS product_active, ps.size,
                ps.product_id AS size_product_id
         FROM Stock s
         INNER JOIN Products p ON p.id = s.product_id
         LEFT JOIN ProductSize ps ON ps.id = s.product_size_id
         WHERE s.warehouse_id = ? AND s.id IN (${placeholders})
         ORDER BY s.id ASC
         FOR UPDATE`,
        [dto.warehouse_id, ...canonicalItems.map((item) => item.stock_id)],
      );
      const lockedById = new Map(lockedRows.map((row: any) => [Number(row.stock_id), row]));
      const conflicts: Array<Record<string, unknown>> = [];
      const unchanged: number[] = [];

      for (const item of canonicalItems) {
        const current: any = lockedById.get(item.stock_id);
        if (!current) {
          conflicts.push({ stock_id: item.stock_id, reason: 'NOT_FOUND_IN_WAREHOUSE' });
          continue;
        }
        const currentQuantity = Number(current.quantity);
        const currentVersion = Number(current.version);
        if (
          Number(current.product_id) !== item.product_id ||
          (current.product_size_id == null ? null : Number(current.product_size_id)) !== item.product_size_id ||
          (item.product_size_id !== null && Number(current.size_product_id) !== item.product_id) ||
          !Boolean(Number(current.product_active))
        ) {
          conflicts.push({ stock_id: item.stock_id, reason: 'INVALID_PRODUCT_RELATION' });
          continue;
        }
        if (currentQuantity !== item.observed_quantity || currentVersion !== item.observed_version) {
          conflicts.push({
            stock_id: item.stock_id,
            sku: current.sku,
            reason: 'STALE_STOCK',
            observed_quantity: item.observed_quantity,
            current_quantity: currentQuantity,
            requested_quantity: item.new_quantity,
            observed_version: item.observed_version,
            current_version: currentVersion,
          });
          continue;
        }
        if (item.new_quantity === currentQuantity) unchanged.push(item.stock_id);
      }

      if (conflicts.length) {
        throw new ConflictException({
          code: 'INVENTORY_CONFLICT',
          message: 'El inventario cambió o contiene relaciones inválidas. Recarga y revisa los valores.',
          atomic: true,
          conflicts,
        });
      }
      if (unchanged.length) {
        throw new BadRequestException({
          message: 'La solicitud contiene filas sin cambios reales',
          stock_ids: unchanged,
        });
      }

      for (const item of canonicalItems) {
        const current: any = lockedById.get(item.stock_id);
        const currentQuantity = Number(current.quantity);
        const difference = item.new_quantity - currentQuantity;
        const updateResult = await manager.query(
          `UPDATE Stock
           SET quantity = ?, version = version + 1, updated_at_utc = ?
           WHERE id = ? AND warehouse_id = ? AND quantity = ? AND version = ?`,
          [
            item.new_quantity,
            occurredAtUtc,
            item.stock_id,
            dto.warehouse_id,
            item.observed_quantity,
            item.observed_version,
          ],
        );
        if (Number(updateResult.affectedRows) !== 1) {
          throw new ConflictException({
            code: 'INVENTORY_CONFLICT',
            message: 'El stock cambió durante la confirmación. No se aplicó ningún ajuste.',
            atomic: true,
            conflicts: [{ stock_id: item.stock_id, reason: 'CONCURRENT_UPDATE' }],
          });
        }

        await manager.query(
          `INSERT INTO InventoryAdjustmentDetails
            (operation_id, stock_id, product_id, product_size_id, sku_snapshot,
             description_snapshot, size_snapshot, previous_quantity, new_quantity,
             difference_quantity, stock_version_before, stock_version_after,
             result, error_message, occurred_at_utc)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'APPLIED', NULL, ?)`,
          [
            operationId,
            item.stock_id,
            item.product_id,
            item.product_size_id,
            current.sku,
            current.description,
            current.size,
            currentQuantity,
            item.new_quantity,
            difference,
            item.observed_version,
            item.observed_version + 1,
            occurredAtUtc,
          ],
        );

        await manager.query(
          `INSERT INTO StockMovements
            (warehouse_id, product_id, product_size_id, quantity,
             previous_quantity, new_quantity, unit_of_measure, movement_type,
             reference_id, reference_type, reference, notes, user_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'ajuste', ?, 'AJUSTE_INVENTARIO', ?, ?, ?, ?)`,
          [
            dto.warehouse_id,
            item.product_id,
            item.product_size_id,
            difference,
            currentQuantity,
            item.new_quantity,
            current.unit_of_measure || 'PAR',
            operationId,
            operationCode,
            `${this.reasonLabel(dto.reason)}${observation ? `: ${observation}` : ''}`,
            user.userId,
            occurredAtUtc,
          ],
        );
      }

      return {
        ...(await this.getOperationWith(manager, operationId)),
        warehouse,
        duplicate: false,
      };
    });
  }

  async getOperation(operationId: number, user: AdjustmentUser) {
    this.assertRole(user);
    return this.getOperationWith(this.dataSource, operationId);
  }

  private async getOperationWith(
    executor: Pick<DataSource | EntityManager, 'query'>,
    operationId: number,
  ) {
    const operations = await executor.query(
      `SELECT o.id, o.operation_code, o.warehouse_id, w.warehouse_name,
              w.type AS warehouse_type, w.location AS warehouse_location,
              o.user_id, o.user_name_snapshot, o.role_snapshot, o.reason_code,
              o.observation, o.correlation_id, o.status, o.item_count,
              CONCAT(DATE_FORMAT(o.occurred_at_utc, '%Y-%m-%dT%H:%i:%s.'),
                     LPAD(FLOOR(MICROSECOND(o.occurred_at_utc) / 1000), 3, '0'), 'Z') AS occurred_at_utc,
              o.occurred_at_lima, DATE_FORMAT(o.business_date, '%Y-%m-%d') AS business_date
       FROM InventoryAdjustmentOperations o
       INNER JOIN Warehouses w ON w.id = o.warehouse_id
       WHERE o.id = ? LIMIT 1`,
      [operationId],
    );
    if (!operations[0]) throw new NotFoundException('Operación de ajuste no encontrada');
    const items = await executor.query(
      `SELECT id, stock_id, product_id, product_size_id, sku_snapshot AS sku,
              description_snapshot AS description, size_snapshot AS size,
              previous_quantity, new_quantity, difference_quantity AS difference,
              stock_version_before, stock_version_after, result
       FROM InventoryAdjustmentDetails
       WHERE operation_id = ? ORDER BY sku_snapshot ASC, size_snapshot ASC`,
      [operationId],
    );
    const normalizedItems = items.map((item: any) => ({
      ...item,
      id: Number(item.id),
      stock_id: Number(item.stock_id),
      product_id: Number(item.product_id),
      product_size_id: Number(item.product_size_id),
      previous_quantity: Number(item.previous_quantity),
      new_quantity: Number(item.new_quantity),
      difference: Number(item.difference),
      stock_version_before: Number(item.stock_version_before),
      stock_version_after: Number(item.stock_version_after),
    }));
    return {
      operation: {
        ...operations[0],
        id: Number(operations[0].id),
        warehouse_id: Number(operations[0].warehouse_id),
        user_id: Number(operations[0].user_id),
        item_count: Number(operations[0].item_count),
      },
      items: normalizedItems,
      summary: {
        item_count: normalizedItems.length,
        total_increase: normalizedItems.reduce((sum: number, item: any) => sum + Math.max(0, item.difference), 0),
        total_decrease: normalizedItems.reduce((sum: number, item: any) => sum + Math.abs(Math.min(0, item.difference)), 0),
        net_difference: normalizedItems.reduce((sum: number, item: any) => sum + item.difference, 0),
      },
    };
  }

  private async findActiveWarehouse(
    executor: Pick<DataSource | EntityManager, 'query'>,
    warehouseId: number,
  ) {
    const rows = await executor.query(
      `SELECT id, warehouse_name, type, location
       FROM Warehouses WHERE id = ? AND status = 1 LIMIT 1`,
      [warehouseId],
    );
    if (!rows[0]) throw new NotFoundException('Almacén inexistente o inactivo');
    return { ...rows[0], id: Number(rows[0].id) };
  }

  private async findActiveActor(manager: EntityManager, user: AdjustmentUser) {
    const rows = await manager.query(
      `SELECT u.id, u.full_name, r.name_role AS role
       FROM Users u INNER JOIN Roles r ON r.id = u.rol_id
       WHERE u.id = ? AND u.state_user = 1 LIMIT 1`,
      [user.userId],
    );
    if (!rows[0]) throw new ForbiddenException('Usuario inexistente o deshabilitado');
    if (rows[0].role !== user.role || !ALLOWED_ROLES.has(rows[0].role)) {
      throw new ForbiddenException('El rol actual no permite ajustar inventario');
    }
    return rows[0];
  }

  private assertRole(user: AdjustmentUser) {
    if (!user || !Number.isInteger(Number(user.userId)) || !ALLOWED_ROLES.has(user.role)) {
      throw new ForbiddenException('No tienes permiso para ajustar inventario');
    }
  }

  private findDuplicates(values: number[]) {
    const seen = new Set<number>();
    const duplicates = new Set<number>();
    for (const value of values) {
      if (seen.has(value)) duplicates.add(value);
      seen.add(value);
    }
    return [...duplicates];
  }

  private cleanCorrelationId(value?: string) {
    const cleaned = value?.trim().replace(/[^a-zA-Z0-9._:-]/g, '').slice(0, 64);
    return cleaned || randomUUID();
  }

  private cleanIp(value?: string) {
    const cleaned = value?.replace(/^::ffff:/, '').trim().slice(0, 45);
    return cleaned || null;
  }

  private reasonLabel(reason: InventoryAdjustmentReason) {
    const labels: Record<InventoryAdjustmentReason, string> = {
      PHYSICAL_COUNT: 'Conteo físico',
      DATA_ENTRY_CORRECTION: 'Corrección de digitación',
      DAMAGED_PRODUCT: 'Producto dañado',
      LOSS_SHRINKAGE: 'Pérdida o merma',
      RETURN: 'Devolución',
      UNREGISTERED_TRANSFER: 'Transferencia no registrada',
      INVENTORY_REGULARIZATION: 'Regularización de inventario',
      OTHER: 'Otro',
    };
    return labels[reason];
  }
}
