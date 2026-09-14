import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InventoryAdjustmentsService } from './inventory-adjustments.service';
import { InventoryAdjustmentReason } from './dto/inventory-adjustment-reason.enum';

describe('InventoryAdjustmentsService', () => {
  const admin = { userId: 1, role: 'Administrador', warehouseId: 6 };
  const dto = (overrides: Record<string, unknown> = {}) => ({
    warehouse_id: 6,
    reason: InventoryAdjustmentReason.PHYSICAL_COUNT,
    idempotency_key: '2a4df235-a9e3-4eb3-b6c8-04b18d79d83b',
    items: [{
      stock_id: 10,
      product_id: 20,
      product_size_id: 30,
      observed_quantity: 5,
      new_quantity: 7,
      observed_version: 1,
    }],
    ...overrides,
  });

  it('deniega roles que no están autorizados en la capa de servicio', async () => {
    const dataSource = { query: jest.fn() };
    const service = new InventoryAdjustmentsService(dataSource as any);
    await expect(service.listAllowedWarehouses({
      userId: 9,
      role: 'Vendedor',
      warehouseId: 1,
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('rechaza motivo Otro sin una explicación suficiente', async () => {
    const dataSource = { transaction: jest.fn() };
    const service = new InventoryAdjustmentsService(dataSource as any);
    await expect(service.create(dto({
      reason: InventoryAdjustmentReason.OTHER,
      observation: 'corto',
    }) as any, admin)).rejects.toBeInstanceOf(BadRequestException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rechaza cantidades negativas incluso si el servicio se invoca sin ValidationPipe', async () => {
    const dataSource = { transaction: jest.fn() };
    const service = new InventoryAdjustmentsService(dataSource as any);
    const invalid = dto();
    invalid.items[0].new_quantity = -1;
    await expect(service.create(invalid as any, admin)).rejects.toThrow('cantidades');
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('detecta filas duplicadas antes de abrir la transacción', async () => {
    const dataSource = { transaction: jest.fn() };
    const service = new InventoryAdjustmentsService(dataSource as any);
    const duplicate = dto();
    duplicate.items.push({ ...duplicate.items[0] });
    await expect(service.create(duplicate as any, admin)).rejects.toThrow('duplicadas');
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rechaza atómicamente un stock modificado por otro usuario', async () => {
    const manager = { query: jest.fn() };
    manager.query
      .mockResolvedValueOnce([{ id: 1, full_name: 'Admin', role: 'Administrador' }])
      .mockResolvedValueOnce([{ id: 6, warehouse_name: 'Central', type: 'PRINCIPAL' }])
      .mockResolvedValueOnce({ affectedRows: 1, insertId: 99 })
      .mockResolvedValueOnce([{
        stock_id: 10,
        warehouse_id: 6,
        product_id: 20,
        product_size_id: 30,
        quantity: 6,
        version: 2,
        product_active: 1,
        sku: 'SKU-1',
      }]);
    const dataSource = {
      transaction: jest.fn((callback) => callback(manager)),
    };
    const service = new InventoryAdjustmentsService(dataSource as any);
    await expect(service.create(dto() as any, admin)).rejects.toBeInstanceOf(ConflictException);
    expect(manager.query).toHaveBeenCalledTimes(4);
    expect(manager.query.mock.calls.some(([sql]) => String(sql).includes('UPDATE Stock'))).toBe(false);
  });

  it('guarda cabecera, detalle, movimiento y devuelve datos confirmados', async () => {
    const manager = { query: jest.fn() };
    manager.query
      .mockResolvedValueOnce([{ id: 1, full_name: 'Admin', role: 'Administrador' }])
      .mockResolvedValueOnce([{ id: 6, warehouse_name: 'Central', type: 'PRINCIPAL' }])
      .mockResolvedValueOnce({ affectedRows: 1, insertId: 99 })
      .mockResolvedValueOnce([{
        stock_id: 10, warehouse_id: 6, product_id: 20, product_size_id: 30,
        quantity: 5, unit_of_measure: 'PAR', version: 1, product_active: 1,
        sku: 'SKU-1', description: 'Producto', size: '38', size_product_id: 20,
      }])
      .mockResolvedValueOnce({ affectedRows: 1 })
      .mockResolvedValueOnce({ insertId: 100 })
      .mockResolvedValueOnce({ insertId: 101 })
      .mockResolvedValueOnce([{
        id: 99, operation_code: 'AJS-20260913-2A4DF235', warehouse_id: 6,
        warehouse_name: 'Central', user_id: 1, item_count: 1,
      }])
      .mockResolvedValueOnce([{
        id: 100, stock_id: 10, product_id: 20, product_size_id: 30,
        previous_quantity: 5, new_quantity: 7, difference: 2,
        stock_version_before: 1, stock_version_after: 2,
      }]);
    const dataSource = { transaction: jest.fn((callback) => callback(manager)) };
    const service = new InventoryAdjustmentsService(dataSource as any);
    const result = await service.create(dto() as any, admin);
    expect(result.duplicate).toBe(false);
    expect(result.summary).toEqual({ item_count: 1, total_increase: 2, total_decrease: 0, net_difference: 2 });
    expect(manager.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO InventoryAdjustmentDetails'))).toBe(true);
    expect(manager.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO StockMovements'))).toBe(true);
  });
});
