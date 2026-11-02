import { ReportsService } from './reports.service';

function queryBuilder(raw: Record<string, unknown>) {
  const builder: any = {
    where: jest.fn(),
    innerJoin: jest.fn(),
    andWhere: jest.fn(),
    select: jest.fn(),
    addSelect: jest.fn(),
    setParameters: jest.fn(),
    getRawOne: jest.fn().mockResolvedValue(raw),
  };

  Object.keys(builder).forEach((key) => {
    if (key !== 'getRawOne') builder[key].mockReturnValue(builder);
  });

  return builder;
}

describe('ReportsService web seller dashboard', () => {
  it('devuelve meta y separa ventas por unidad y por mayor', async () => {
    const salesQuery = queryBuilder({
      total_orders: 6,
      pending_orders: 1,
      approved_orders: 1,
      dispatched_orders: 1,
      delivered_orders: 3,
      canceled_orders: 0,
      total_amount: 1200,
      delivered_amount: 900,
      unit_orders: 4,
      wholesale_orders: 2,
    });
    const detailsQuery = queryBuilder({
      total_pairs_registered: 15,
      total_pairs_sold: 12,
      total_pairs_pending: 3,
      total_pairs_returned: 0,
      sold_amount: 900,
      pending_amount: 300,
      returned_amount: 0,
      unit_pairs_sold: 4,
      wholesale_pairs_sold: 8,
      unit_sold_amount: 360,
      wholesale_sold_amount: 540,
      unit_orders: 4,
      wholesale_orders: 2,
    });

    const service = new ReportsService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {
        findOne: jest.fn().mockResolvedValue({
          id: 7,
          warehouse: { monto: 1500, cantidad_pares: 20 },
        }),
      } as any,
      {} as any,
      { createQueryBuilder: jest.fn().mockReturnValue(salesQuery) } as any,
      { createQueryBuilder: jest.fn().mockReturnValue(detailsQuery) } as any,
    );

    const result = await service.getMonthlyWebSalesTotal({
      userId: 7,
      role: 'Vendedor Web',
    });

    expect(result.meta_mensual).toEqual({
      monto_objetivo: 1500,
      pares_objetivo: 20,
    });
    expect(result.canales).toEqual({
      unidad: { pedidos: 4, pares_vendidos: 4, monto_vendido: 360 },
      mayor: { pedidos: 2, pares_vendidos: 8, monto_vendido: 540 },
    });
    expect(result.pares.vendidos).toBe(12);
    expect(result.importes.total_vendido_real).toBe(900);
    expect(result.pedidos.total).toBe(3);

    const detailSelections = detailsQuery.addSelect.mock.calls
      .map((call: unknown[]) => String(call[0]))
      .join('\n');
    expect(detailSelections).toContain('webSale.status = :delivered');
  });
});
