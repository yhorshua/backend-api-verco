import { calculateBundleDiscountCents } from './storefront.service';

describe('descuento de conjunto ecommerce', () => {
  it('aplica 5% a un polo y un short', () => {
    expect(
      calculateBundleDiscountCents(3500, ['Polo niña rosa', 'Short jean niña']),
    ).toBe(175);
  });

  it('no aplica descuento a dos prendas superiores', () => {
    expect(
      calculateBundleDiscountCents(3500, ['Polo niña', 'Blusa niña']),
    ).toBe(0);
  });

  it('redondea el descuento a centavos', () => {
    expect(
      calculateBundleDiscountCents(1999, ['Polera niña', 'Jean niña']),
    ).toBe(100);
  });
});
