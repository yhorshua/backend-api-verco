import { SaleDetail } from '../database/entities/sale-detail.entity';
import { buildSellerCommissionSummary } from './reports.service';

describe('buildSellerCommissionSummary', () => {
  function detail(values: {
    sellerId: number;
    sellerName: string;
    category: string;
    quantity: number;
    unitPrice: number;
    snapshotCost: number;
    currentCost?: number;
    saleId: number;
  }): SaleDetail {
    return {
      id: values.saleId,
      sale_id: values.saleId,
      product_id: values.saleId,
      product_size_id: null,
      stock_movement_id: null,
      quantity: values.quantity,
      unit_price: values.unitPrice,
      factory_price_at_sale: values.snapshotCost,
      sale: {
        id: values.saleId,
        sale_code: `V${values.saleId}`,
        sale_date: new Date('2026-11-01T10:00:00-05:00'),
        user_id: values.sellerId,
        user: { full_name: values.sellerName },
      },
      product: {
        article_code: `P${values.saleId}`,
        article_description: `Producto ${values.saleId}`,
        factory_price: values.currentCost ?? values.snapshotCost,
        category: { name: values.category },
      },
      productSize: null,
    } as SaleDetail;
  }

  it('separa zapatillas y accesorios y calcula compra, venta, utilidad y cantidades', () => {
    const result = buildSellerCommissionSummary([
      detail({
        sellerId: 1,
        sellerName: 'Ana',
        category: 'ZAPATILLAS',
        quantity: 2,
        unitPrice: 70,
        snapshotCost: 30,
        saleId: 1,
      }),
      detail({
        sellerId: 1,
        sellerName: 'Ana',
        category: 'Accesorios',
        quantity: 3,
        unitPrice: 10,
        snapshotCost: 4,
        saleId: 2,
      }),
      detail({
        sellerId: 2,
        sellerName: 'Luis',
        category: 'Calzado',
        quantity: 1,
        unitPrice: 100,
        snapshotCost: 0,
        currentCost: 40,
        saleId: 3,
      }),
    ]);

    expect(result.totals).toEqual({
      quantity: 6,
      commissionable_quantity: 5,
      purchase_amount: 112,
      sales_amount: 270,
      profit: 158,
      commission: 5,
    });
    expect(result.categories).toEqual([
      expect.objectContaining({
        category: 'Zapatillas',
        quantity: 3,
        commissionable_quantity: 2,
        purchase_amount: 100,
        sales_amount: 240,
        profit: 140,
      }),
      expect.objectContaining({
        category: 'Accesorios',
        quantity: 3,
        commissionable_quantity: 3,
        purchase_amount: 12,
        sales_amount: 30,
        profit: 18,
      }),
    ]);
    expect(result.sellers).toEqual([
      expect.objectContaining({
        seller_name: 'Ana',
        total_quantity: 5,
        total_purchase_amount: 72,
        total_sales_amount: 170,
        total_profit: 98,
        total_commission: 4,
      }),
      expect.objectContaining({
        seller_name: 'Luis',
        total_quantity: 1,
        total_purchase_amount: 40,
        total_sales_amount: 100,
        total_profit: 60,
        total_commission: 1,
      }),
    ]);
  });
});
