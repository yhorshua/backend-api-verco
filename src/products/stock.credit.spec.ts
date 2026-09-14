import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Sale } from '../database/entities/sale.entity';
import { CreateSaleDto } from './dto/create-sale.dto';
import { StockService } from './stock.service';

describe('StockService - condiciones de venta a crédito', () => {
  let service: StockService;

  beforeEach(() => {
    service = new StockService(
      null as never,
      null as never,
      null as never,
      null as never,
      null as never,
      null as never,
      null as never,
      null as never,
    );
  });

  const resolve = (dto: Partial<CreateSaleDto>, total: number) =>
    (service as any).resolveCreditTerms(dto, total);

  it('normaliza los campos de una venta al contado', () => {
    expect(resolve({ payment_method: 'efectivo' }, 500)).toEqual({
      monto_adelanto: 0,
      metodo_pago_adelanto: null,
      monto_restante: 0,
      fecha_proximo_pago: null,
    });
  });

  it('registra crédito sin adelanto y exige próximo pago', () => {
    expect(
      resolve(
        {
          payment_method: 'credito',
          monto_adelanto: 0,
          monto_restante: 500,
          fecha_proximo_pago: '2026-09-30',
        },
        500,
      ),
    ).toEqual({
      monto_adelanto: 0,
      metodo_pago_adelanto: null,
      monto_restante: 500,
      fecha_proximo_pago: '2026-09-30',
    });
  });

  it('calcula un adelanto parcial con dos decimales', () => {
    expect(
      resolve(
        {
          payment_method: 'credito',
          monto_adelanto: 100.05,
          metodo_pago_adelanto: 'yape',
          monto_restante: 400.05,
          fecha_proximo_pago: '2026-09-30',
        },
        500.1,
      ),
    ).toEqual({
      monto_adelanto: 100.05,
      metodo_pago_adelanto: 'yape',
      monto_restante: 400.05,
      fecha_proximo_pago: '2026-09-30',
    });
  });

  it('permite que el adelanto sea igual al total', () => {
    expect(
      resolve(
        {
          payment_method: 'credito',
          monto_adelanto: 500,
          metodo_pago_adelanto: 'efectivo',
          monto_restante: 0,
        },
        500,
      ),
    ).toEqual({
      monto_adelanto: 500,
      metodo_pago_adelanto: 'efectivo',
      monto_restante: 0,
      fecha_proximo_pago: null,
    });
  });

  it('rechaza un adelanto superior al total', () => {
    expect(() =>
      resolve(
        {
          payment_method: 'credito',
          monto_adelanto: 500.01,
          metodo_pago_adelanto: 'efectivo',
        },
        500,
      ),
    ).toThrow(BadRequestException);
  });

  it('rechaza crédito con adelanto sin método de pago', () => {
    expect(() =>
      resolve(
        {
          payment_method: 'credito',
          monto_adelanto: 100,
          fecha_proximo_pago: '2026-09-30',
        },
        500,
      ),
    ).toThrow('El método del adelanto debe ser efectivo o yape');
  });

  it('rechaza fecha vacía cuando queda saldo', () => {
    expect(() =>
      resolve(
        {
          payment_method: 'credito',
          monto_adelanto: 100,
          metodo_pago_adelanto: 'efectivo',
        },
        500,
      ),
    ).toThrow('La fecha de próximo pago es obligatoria');
  });

  it('rechaza fechas que no usan YYYY-MM-DD', () => {
    expect(() =>
      resolve(
        {
          payment_method: 'credito',
          monto_adelanto: 100,
          metodo_pago_adelanto: 'efectivo',
          fecha_proximo_pago: '30/09/2026',
        },
        500,
      ),
    ).toThrow('YYYY-MM-DD');
  });

  it('rechaza un saldo del navegador distinto al cálculo del backend', () => {
    expect(() =>
      resolve(
        {
          payment_method: 'credito',
          monto_adelanto: 100,
          metodo_pago_adelanto: 'efectivo',
          monto_restante: 399,
          fecha_proximo_pago: '2026-09-30',
        },
        500,
      ),
    ).toThrow('no coincide con el saldo calculado');
  });

  it('rechaza campos de crédito con otro método de pago', () => {
    expect(() =>
      resolve(
        {
          payment_method: 'yape',
          monto_adelanto: 100,
        },
        500,
      ),
    ).toThrow('solo pueden enviarse cuando payment_method es credito');
  });

  it('incluye los cuatro campos en el objeto enviado al INSERT de Sales', async () => {
    const manager = {
      create: jest.fn((_entity, data) => data),
      save: jest.fn(async (_entity, data) => Object.assign(data, { id: 1 })),
    };
    const creditTerms = resolve(
      {
        payment_method: 'credito',
        monto_adelanto: 100,
        metodo_pago_adelanto: 'efectivo',
        monto_restante: 400,
        fecha_proximo_pago: '2026-09-30',
      },
      500,
    );

    const sale = await (service as any).createSaleHeader(
      manager,
      {
        warehouse_id: 1,
        user_id: 2,
        payment_method: 'credito',
      },
      'V99999',
      500,
      creditTerms,
    );

    expect(manager.create).toHaveBeenCalledWith(
      Sale,
      expect.objectContaining({
        payment_method: 'credito',
        monto_adelanto: 100,
        metodo_pago_adelanto: 'efectivo',
        monto_restante: 400,
        fecha_proximo_pago: '2026-09-30',
      }),
    );
    expect(sale).toEqual(expect.objectContaining({ id: 1, monto_restante: 400 }));
  });

  it('acepta el payload HTTP canónico en snake_case sin descartar campos', async () => {
    const dto = plainToInstance(CreateSaleDto, {
      warehouse_id: 1,
      user_id: 2,
      payment_method: 'credito',
      monto_adelanto: 100,
      metodo_pago_adelanto: 'efectivo',
      monto_restante: 400,
      fecha_proximo_pago: '2026-09-30',
      items: [
        {
          product_id: 10,
          product_size_id: 20,
          quantity: 1,
          unit_of_measure: 'PAR',
          unit_price: 500,
        },
      ],
    });

    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors).toHaveLength(0);
    expect(dto).toEqual(
      expect.objectContaining({
        monto_adelanto: 100,
        metodo_pago_adelanto: 'efectivo',
        monto_restante: 400,
        fecha_proximo_pago: '2026-09-30',
      }),
    );
  });

  it('rechaza nombres camelCase antiguos dentro de payment', async () => {
    const dto = plainToInstance(CreateSaleDto, {
      warehouse_id: 1,
      user_id: 2,
      payment_method: 'credito',
      payment: {
        montoAdelanto: 100,
        metodoPagoAdelanto: 'efectivo',
        fechaProximoPago: '2026-09-30',
      },
      items: [
        {
          product_id: 10,
          product_size_id: 20,
          quantity: 1,
          unit_of_measure: 'PAR',
          unit_price: 500,
        },
      ],
    });

    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors.length).toBeGreaterThan(0);
  });
});
