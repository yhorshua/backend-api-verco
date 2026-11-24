import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateEcommerceOrderDto } from './create-ecommerce-order.dto';

const validOrder = {
  idempotency_key: '123e4567-e89b-42d3-a456-426614174000',
  customer_name: 'Cliente prueba',
  customer_document: '12345678',
  customer_phone: '999999999',
  customer_address: 'Av. Prueba 123',
  department: 'LIMA',
  department_code: '15',
  province: 'LIMA',
  province_code: '1501',
  district: 'SAN JUAN DE LURIGANCHO',
  district_code: '150132',
  payment_method: 'yape',
  delivery_type: 'DOMICILIO_LIMA',
  items: [{ product_id: 1, product_size_id: 1, quantity: 1 }],
};

describe('CreateEcommerceOrderDto', () => {
  it.each(['yape', 'plin', 'contra_entrega'])('acepta el medio de pago %s', async (payment_method) => {
    const dto = plainToInstance(CreateEcommerceOrderDto, { ...validOrder, payment_method });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rechaza medios de pago no habilitados para Soomin', async () => {
    const dto = plainToInstance(CreateEcommerceOrderDto, { ...validOrder, payment_method: 'tarjeta' });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'payment_method')).toBe(true);
  });

  it('exige los códigos de ubigeo y la dirección', async () => {
    const dto = plainToInstance(CreateEcommerceOrderDto, {
      ...validOrder,
      customer_address: '',
      department_code: '',
      province_code: '',
      district_code: '',
    });
    const properties = (await validate(dto)).map((error) => error.property);
    expect(properties).toEqual(expect.arrayContaining([
      'customer_address',
      'department_code',
      'province_code',
      'district_code',
    ]));
  });
});
