import { BadRequestException } from '@nestjs/common';
import { Order } from '../database/entities/orders.entity';
import { OrdersHistorial } from '../database/entities/orders-historial.entity';
import { StockReservation } from '../database/entities/stock_reservations.entity';
import { OrderStatusEnum } from './dto/orderStatusEnum';
import { OrdersService } from './orders.service';

function serviceFor(order: Record<string, unknown>) {
  const orderRepo = {
    findOne: jest.fn().mockResolvedValue(order),
    save: jest.fn(async (value) => value),
  };
  const historyRepo = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
  };
  const reservationRepo = { update: jest.fn().mockResolvedValue({ affected: 1 }) };
  const manager = {
    getRepository: jest.fn((entity) => {
      if (entity === Order) return orderRepo;
      if (entity === OrdersHistorial) return historyRepo;
      if (entity === StockReservation) return reservationRepo;
      throw new Error(`Repositorio inesperado: ${entity?.name}`);
    }),
  };
  const dataSource = { transaction: jest.fn((callback) => callback(manager)) };
  const events = { emit: jest.fn() };
  const service = new OrdersService(
    dataSource as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    events as any,
  );
  return { service, dataSource, events, orderRepo, historyRepo, reservationRepo };
}

describe('OrdersService approval workflow', () => {
  it('aprueba con bloqueo, auditoría y notificación posterior al commit', async () => {
    const fixture = serviceFor({ id: 10, proforma_number: 501, user_id: 7, order_status_id: OrderStatusEnum.PENDIENTE });
    const result = await fixture.service.approveOrder(10, 2);

    expect(result.order.order_status_id).toBe(OrderStatusEnum.APROBADO);
    expect(fixture.orderRepo.findOne).toHaveBeenCalledWith(expect.objectContaining({ lock: { mode: 'pessimistic_write' } }));
    expect(fixture.historyRepo.save).toHaveBeenCalled();
    expect(fixture.events.emit).toHaveBeenCalledWith('order.updated', expect.objectContaining({ sellerId: 7, status: 'APROBADO' }));
  });

  it('impide aprobar dos veces el mismo pedido', async () => {
    const fixture = serviceFor({ id: 10, proforma_number: 501, user_id: 7, order_status_id: OrderStatusEnum.APROBADO });
    await expect(fixture.service.approveOrder(10, 2)).rejects.toBeInstanceOf(BadRequestException);
    expect(fixture.events.emit).not.toHaveBeenCalled();
  });

  it('exige motivo antes de iniciar una transacción de rechazo', async () => {
    const fixture = serviceFor({ id: 10, proforma_number: 501, user_id: 7, order_status_id: OrderStatusEnum.PENDIENTE });
    await expect(fixture.service.rejectOrder(10, 2, ' ')).rejects.toBeInstanceOf(BadRequestException);
    expect(fixture.dataSource.transaction).not.toHaveBeenCalled();
  });

  it('libera reservas, audita y notifica un rechazo', async () => {
    const fixture = serviceFor({ id: 10, proforma_number: 501, user_id: 7, order_status_id: OrderStatusEnum.PENDIENTE });
    const result = await fixture.service.rejectOrder(10, 2, 'Stock no confirmado');

    expect(result.order.order_status_id).toBe(OrderStatusEnum.RECHAZADO);
    expect(fixture.reservationRepo.update).toHaveBeenCalled();
    expect(fixture.events.emit).toHaveBeenCalledWith('order.updated', expect.objectContaining({ sellerId: 7, status: 'RECHAZADO' }));
  });
});
