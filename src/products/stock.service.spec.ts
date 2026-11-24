import { StockService } from './stock.service';
import { BadRequestException } from '@nestjs/common';
import { StockMovement } from '../database/entities/stock-movements';
import { SaleDetail } from '../database/entities/sale-detail.entity';
import { CashMovement } from '../database/entities/cash-movement.entity';

describe('StockService cash session validation', () => {
  const service = new StockService(
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never,
  );

  it('uses the open register of the warehouse regardless of who opened it', async () => {
    const manager = {
      query: jest.fn().mockResolvedValue([{ id: 27 }]),
    };

    const sessionId = await (service as any).requireOpenCashSession(manager, 4);

    expect(sessionId).toBe(27);
    expect(manager.query).toHaveBeenCalledWith(
      expect.not.stringContaining('user_id = ?'),
      [4],
    );
  });

  it('still rejects a sale when the warehouse has no open register', async () => {
    const manager = { query: jest.fn().mockResolvedValue([]) };

    await expect(
      (service as any).requireOpenCashSession(manager, 4),
    ).rejects.toThrow('No hay caja abierta para warehouse_id=4');
  });
});

describe('StockService optimized sale persistence', () => {
  const service = new StockService(
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never,
  );

  it('rejects duplicate product and size lines before querying stock', async () => {
    const manager = { getRepository: jest.fn() };

    await expect(
      (service as any).validateStockAndComputeTotal(manager, {
        warehouse_id: 5,
        items: [
          { product_id: 10, product_size_id: 20, quantity: 1, unit_price: 50 },
          { product_id: 10, product_size_id: 20, quantity: 1, unit_price: 50 },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(manager.getRepository).not.toHaveBeenCalled();
  });

  it('persists movements, details and stock with batch operations', async () => {
    const manager = {
      create: jest.fn((_entity, data) => ({ ...data })),
      insert: jest.fn().mockResolvedValue({}),
      query: jest
        .fn()
        .mockResolvedValueOnce([
          { id: 101, product_id: 10, product_size_id: 20 },
          { id: 102, product_id: 11, product_size_id: 21 },
        ])
        .mockResolvedValueOnce({ affectedRows: 2 }),
      save: jest.fn(),
    };

    const validated = [
      {
        item: {
          product_id: 10,
          product_size_id: 20,
          quantity: 1,
          unit_price: 50,
          unit_of_measure: 'PAR',
        },
        stock: { id: 1, quantity: 4 },
        previous_quantity: 5,
        new_quantity: 4,
        unit_price: 50,
        factory_price_at_sale: 30,
      },
      {
        item: {
          product_id: 11,
          product_size_id: 21,
          quantity: 2,
          unit_price: 60,
          unit_of_measure: 'PAR',
        },
        stock: { id: 2, quantity: 6 },
        previous_quantity: 8,
        new_quantity: 6,
        unit_price: 60,
        factory_price_at_sale: 35,
      },
    ];

    const result = await (service as any).createDetailsAndStockOutputs(
      manager,
      { warehouse_id: 5, user_id: 4 },
      { id: 77, sale_code: 'V00077' },
      validated,
    );

    expect(manager.insert).toHaveBeenNthCalledWith(
      1,
      StockMovement,
      expect.any(Array),
    );
    expect(manager.insert).toHaveBeenNthCalledWith(
      2,
      SaleDetail,
      expect.any(Array),
    );
    expect(manager.query.mock.calls[1][0]).toContain('UPDATE Stock');
    expect(manager.save).not.toHaveBeenCalled();
    expect(result.map((movement: StockMovement) => movement.id)).toEqual([
      101, 102,
    ]);
  });

  it('inserts cash movements in one batch', async () => {
    const manager = {
      create: jest.fn((_entity, data) => ({ ...data })),
      insert: jest.fn().mockResolvedValue({}),
    };

    await (service as any).createCashMovementsFromPayments(
      manager,
      9,
      { warehouse_id: 5, user_id: 4 },
      { id: 77, sale_code: 'V00077' },
      [
        { id: 201, method: 'yape', amount: 40, operation_number: '123456' },
        { id: 202, method: 'efectivo', amount: 60, operation_number: null },
      ],
    );

    expect(manager.insert).toHaveBeenCalledTimes(1);
    expect(manager.insert).toHaveBeenCalledWith(
      CashMovement,
      expect.any(Array),
    );
    expect(manager.insert.mock.calls[0][1]).toHaveLength(2);
  });
});
