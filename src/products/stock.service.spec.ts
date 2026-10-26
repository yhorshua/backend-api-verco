import { StockService } from './stock.service';

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
