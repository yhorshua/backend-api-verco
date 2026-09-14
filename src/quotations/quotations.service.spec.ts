import { BadRequestException } from '@nestjs/common';
import { QuotationsService } from './quotations.service';

const actor = { userId: 7, role: 'Vendedor', warehouseId: 2 };

function dto(idempotency_key: string, unit_price = '10.00') {
  return {
    client_id: 3,
    seller_id: 7,
    warehouse_id: 2,
    idempotency_key,
    expires_on: '2026-12-31',
    items: [{
      product_id: 11,
      product_size_id: 22,
      quantity: 3,
      unit_price,
      discount_amount: '1.00',
      tax_amount: '0.00',
    }],
  };
}

function transactionManager(sequence: number, savedNumbers: string[]) {
  return {
    query: jest.fn(async (sql: string, params: unknown[]) => {
      if (sql.includes('FROM Quotations WHERE idempotency_key')) return [];
      if (sql.includes('FROM Users u JOIN Roles')) return [{ id: 7, name_role: 'Vendedor' }];
      if (sql.includes('FROM Warehouses')) return [{ id: 2 }];
      if (sql.includes('FROM Clients')) return [{ id: 3, seller_id: 7 }];
      if (sql.includes('FROM Products p')) return [{
        id: 11,
        article_code: 'SKU-11',
        article_description: 'Producto de prueba',
        status: 1,
        wholesale_price: '10.00',
        product_size_id: 22,
        size: '38',
        quantity: 20,
        reserved_quantity: 0,
      }];
      if (sql.includes('SELECT last_number FROM QuotationSequences')) return [{ last_number: sequence }];
      if (sql.includes('INSERT INTO Quotations')) {
        savedNumbers.push(String(params[0]));
        expect(params).toEqual(expect.arrayContaining(['30.00', '1.00', '0.00', '29.00']));
        return { insertId: sequence + 100 };
      }
      return [];
    }),
  };
}

describe('QuotationsService', () => {
  it('asigna correlativos distintos usando bloqueo transaccional y calcula importes exactos', async () => {
    const numbers: string[] = [];
    let nextSequence = 0;
    const managers: ReturnType<typeof transactionManager>[] = [];
    const dataSource = {
      transaction: jest.fn(async (callback: (manager: any) => Promise<number>) => {
        const manager = transactionManager(nextSequence++, numbers);
        managers.push(manager);
        return callback(manager);
      }),
    };
    const service = new QuotationsService(dataSource as any);
    jest.spyOn(service, 'getById').mockImplementation(async (id: number) => ({ quotation: { id }, details: [], history: [] } as any));

    await Promise.all([
      service.create(dto('11111111-1111-4111-8111-111111111111'), actor),
      service.create(dto('22222222-2222-4222-8222-222222222222'), actor),
    ]);

    expect(numbers).toHaveLength(2);
    expect(new Set(numbers).size).toBe(2);
    expect(numbers[0]).toMatch(/^CO-\d{4}-000001$/);
    expect(numbers[1]).toMatch(/^CO-\d{4}-000002$/);
    for (const manager of managers) {
      expect(manager.query.mock.calls.some(([sql]) => String(sql).includes('FOR UPDATE'))).toBe(true);
    }
  });

  it('rechaza que un vendedor altere el precio mayorista vigente', async () => {
    const manager = transactionManager(0, []);
    const dataSource = { transaction: jest.fn((callback) => callback(manager)) };
    const service = new QuotationsService(dataSource as any);

    await expect(
      service.create(dto('33333333-3333-4333-8333-333333333333', '1.00'), actor),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('aplica búsqueda, paginación y ordenamiento usando una lista blanca', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0 }]);
    const service = new QuotationsService({ query } as any);

    const result = await service.list({
      search: 'CO-2026',
      sort_by: 'total; DROP TABLE Quotations',
      sort_direction: 'asc',
      page: '2',
      limit: '10',
    }, actor);

    expect(result.pagination).toEqual({ page: 2, limit: 10, total: 0, totalPages: 0 });
    expect(query.mock.calls[0][0]).toContain('q.quote_number LIKE ?');
    expect(query.mock.calls[0][0]).toContain('ORDER BY q.issued_at_utc ASC');
    expect(query.mock.calls[0][0]).not.toContain('DROP TABLE');
    expect(query.mock.calls[0][1]).toEqual(expect.arrayContaining(['%CO-2026%', 7, 10, 10]));
  });
});
