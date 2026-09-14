import { BadRequestException } from '@nestjs/common';
import { PendingPaymentsService, PaymentUser } from './pending-payments.service';

describe('PendingPaymentsService', () => {
  const user: PaymentUser = { userId: 7, role: 'Tienda', warehouseId: 4 };

  function sale(overrides: Record<string, unknown> = {}) {
    return {
      id: 10,
      sale_code: 'V00100',
      warehouse_id: 4,
      payment_method: 'credito',
      total_amount: '100.00',
      monto_adelanto: '0.00',
      monto_restante: '100.00',
      payment_status: 'PENDING',
      fecha_proximo_pago: '2026-01-10',
      ...overrides,
    };
  }

  function paymentDto(overrides: Record<string, unknown> = {}) {
    return {
      amount: '100.00',
      payment_date: '2025-12-01',
      method: 'efectivo' as const,
      idempotency_key: '9d88d8cc-dbbc-4b2c-a4ba-03f533f38998',
      ...overrides,
    };
  }

  function paymentHarness(lockedSale: Record<string, unknown>, snapshot?: Record<string, unknown>) {
    const manager = { query: jest.fn() };
    const dataSource = {
      transaction: jest.fn(async (callback: (value: typeof manager) => unknown) => callback(manager)),
      query: jest.fn(),
    };
    const service = new PendingPaymentsService(dataSource as any);
    manager.query
      .mockResolvedValueOnce([lockedSale])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 33 }])
      .mockResolvedValueOnce({ insertId: 90 })
      .mockResolvedValueOnce({ affectedRows: 1 })
      .mockResolvedValueOnce({ insertId: 91 })
      .mockResolvedValueOnce([snapshot ?? lockedSale]);
    return { manager, service };
  }

  it('registra el pago total de una venta sin adelanto', async () => {
    const { manager, service } = paymentHarness(
      sale(),
      sale({ monto_restante: '0.00', payment_status: 'PAID' }),
    );
    const result = await service.registerPayment(10, paymentDto(), user);

    expect(result.sale.payment_status).toBe('PAID');
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE Sales'),
      ['0.00', 'PAID', null, 10],
    );
  });

  it('conserva el adelanto y actualiza solo el saldo en una venta con adelanto', async () => {
    const original = sale({ monto_adelanto: '20.00', monto_restante: '80.00' });
    const { manager, service } = paymentHarness(
      original,
      sale({ monto_adelanto: '20.00', monto_restante: '50.00' }),
    );
    const result = await service.registerPayment(
      10,
      paymentDto({ amount: '30.00', next_payment_date: '2026-01-15' }),
      user,
    );

    expect(result.sale.monto_adelanto).toBe('20.00');
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE Sales'),
      ['50.00', 'PENDING', '2026-01-15', 10],
    );
  });

  it('marca la venta como cancelada cuando el pago cubre el saldo', async () => {
    const { service } = paymentHarness(
      sale({ monto_restante: '73.90' }),
      sale({ monto_restante: '0.00', payment_status: 'PAID' }),
    );
    const result = await service.registerPayment(10, paymentDto({ amount: '73.90' }), user);
    expect(result.message).toContain('cancelada');
    expect(result.duplicate).toBe(false);
  });

  it('rechaza un pago superior al saldo', async () => {
    const manager = { query: jest.fn().mockResolvedValueOnce([sale({ monto_restante: '50.00' })]).mockResolvedValueOnce([]) };
    const dataSource = { transaction: jest.fn((callback) => callback(manager)) };
    const service = new PendingPaymentsService(dataSource as any);

    await expect(
      service.registerPayment(10, paymentDto({ amount: '50.01' }), user),
    ).rejects.toThrow('no puede superar');
  });

  it('rechaza una venta que ya está cancelada', async () => {
    const manager = { query: jest.fn().mockResolvedValueOnce([sale({ monto_restante: '0.00', payment_status: 'PAID' })]).mockResolvedValueOnce([]) };
    const dataSource = { transaction: jest.fn((callback) => callback(manager)) };
    const service = new PendingPaymentsService(dataSource as any);

    await expect(service.registerPayment(10, paymentDto(), user)).rejects.toThrow(
      'ya se encuentra cancelada',
    );
  });

  it('devuelve el pago anterior al repetir la misma clave idempotente', async () => {
    const manager = { query: jest.fn() };
    manager.query
      .mockResolvedValueOnce([sale({ monto_restante: '0.00', payment_status: 'PAID' })])
      .mockResolvedValueOnce([{
        id: 90,
        sale_id: 10,
        amount: '100.00',
        method: 'efectivo',
        payment_date: '2025-12-01',
        registered_by_user_id: 7,
      }])
      .mockResolvedValueOnce([sale({ monto_restante: '0.00', payment_status: 'PAID' })]);
    const dataSource = { transaction: jest.fn((callback) => callback(manager)) };
    const service = new PendingPaymentsService(dataSource as any);

    const result = await service.registerPayment(10, paymentDto(), user);
    expect(result.duplicate).toBe(true);
    expect(manager.query).toHaveBeenCalledTimes(3);
  });

  it('aplica listado, búsqueda, filtros, paginación y alcance por almacén', async () => {
    const dataSource = {
      query: jest.fn()
        .mockResolvedValueOnce([{ id: 10, payment_state: 'vencido' }])
        .mockResolvedValueOnce([{ total: 1 }]),
    };
    const service = new PendingPaymentsService(dataSource as any);
    const result = await service.list(
      {
        page: 2,
        limit: 10,
        search: 'V001',
        status: 'overdue',
        from: '2025-01-01',
        to: '2025-12-31',
        sortBy: 'monto_restante',
        sortDir: 'DESC',
      },
      user,
    );

    expect(result.meta).toEqual({ page: 2, limit: 10, total: 1, totalPages: 1 });
    expect(dataSource.query.mock.calls[0][0]).toContain(
      's.fecha_proximo_pago < clock.business_date',
    );
    expect(dataSource.query.mock.calls[0][0]).toContain('ORDER BY s.monto_restante DESC');
    expect(dataSource.query.mock.calls[0][1]).toEqual([
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      4, '%V001%', '%V001%', '%V001%', '%V001%', '2025-01-01', '2025-12-31', 10, 10,
    ]);
  });

  it('cuenta una sola vez las ventas a crédito con saldo pendiente del almacén', async () => {
    const dataSource = { query: jest.fn().mockResolvedValueOnce([{ pending_credits: 3 }]) };
    const service = new PendingPaymentsService(dataSource as any);
    const result = await service.count(user);
    expect(result.pendingCredits).toBe(3);
    expect(result.definition).toBe('credit_sales_with_pending_balance');
    expect(dataSource.query.mock.calls[0][0]).toContain('COUNT(DISTINCT s.id)');
    expect(dataSource.query.mock.calls[0][0]).toContain("s.payment_method = 'credito'");
    expect(dataSource.query.mock.calls[0][1]).toEqual([4]);
  });

  it('rechaza importes cero y negativos sin iniciar la transacción', async () => {
    const dataSource = { transaction: jest.fn() };
    const service = new PendingPaymentsService(dataSource as any);

    await expect(service.registerPayment(10, paymentDto({ amount: '0.00' }), user)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.registerPayment(10, paymentDto({ amount: '-1.00' }), user)).rejects.toBeInstanceOf(BadRequestException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
