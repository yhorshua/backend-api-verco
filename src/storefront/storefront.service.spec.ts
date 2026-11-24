import { BadRequestException } from '@nestjs/common';
import {
  centsToMoney,
  deriveVariantCodes,
  moneyToCents,
} from './storefront.service';

describe('Storefront helpers', () => {
  it('agrupa el código 15525BD en modelo y color', () => {
    expect(deriveVariantCodes('15525BD')).toEqual({
      groupCode: '15525',
      colorCode: 'BD',
    });
  });

  it('mantiene códigos sin sufijo de dos letras como grupo propio', () => {
    expect(deriveVariantCodes('SKU-100')).toEqual({
      groupCode: 'SKU-100',
      colorCode: 'SKU-100',
    });
  });

  it('calcula importes exactos en centavos', () => {
    expect(moneyToCents('129.90')).toBe(12990);
    expect(moneyToCents('10.5')).toBe(1050);
    expect(centsToMoney(12990)).toBe('129.90');
  });

  it('rechaza importes con más de dos decimales', () => {
    expect(() => moneyToCents('10.999')).toThrow(BadRequestException);
  });
});
