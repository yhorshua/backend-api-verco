import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateEcommerceOrderStatusDto } from './update-ecommerce-order-status.dto';

describe('UpdateEcommerceOrderStatusDto', () => {
  it('acepta la cancelación con un motivo válido', async () => {
    const dto = plainToInstance(UpdateEcommerceOrderStatusDto, {
      status: 'CANCELADO',
      cancellation_reason: 'El cliente solicitó cancelar el pedido',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rechaza motivos demasiado cortos', async () => {
    const dto = plainToInstance(UpdateEcommerceOrderStatusDto, {
      status: 'CANCELADO',
      cancellation_reason: 'No',
    });
    const properties = (await validate(dto)).map((error) => error.property);
    expect(properties).toContain('cancellation_reason');
  });
});
