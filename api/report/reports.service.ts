import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';

import { Sale } from '../database/entities/sale.entity';
import { SaleDetail } from '../database/entities/sale-detail.entity';
import { SalePayment } from '../database/entities/sale-payments.entity';
import { Warehouse } from '../database/entities/warehouse.entity';
import { User } from '../database/entities/user.entity';

import { SalesReportQueryDto } from './dto/sales-report.query.dto';

type ReportRow = {
  sale_id: number;
  sale_code: string;
  sale_date: Date;

  warehouse_id: number;
  warehouse_name: string | null;

  user_id: number;
  user_name: string;

  customer_id: number | null;

  total_amount: string; // viene como string si es decimal MySQL
  payment_method: string | null;

  details: Array<{
    id: number;
    product_id: number;
    article_code: string;
    article_description: string;
    product_size_id: number | null;
    size: string | null;
    quantity: string;
    unit_price: string;
    line_total: string;
  }>;

  payments: Array<{
    id: number;
    method: string;
    amount: string;
    operation_number?: string | null;
    cash_received: string | null;
    cash_change: string | null;
    notes: string | null;
  }>;
};

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Sale) private readonly saleRepo: Repository<Sale>,
    @InjectRepository(SaleDetail) private readonly saleDetailRepo: Repository<SaleDetail>,
    @InjectRepository(SalePayment) private readonly salePaymentRepo: Repository<SalePayment>,
    @InjectRepository(Warehouse) private readonly warehouseRepo: Repository<Warehouse>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  private buildRange(dto: SalesReportQueryDto): { start: Date; end: Date } {
    if (dto.type === 'DAY') {
      if (!dto.date) throw new BadRequestException('date is required when type=DAY');
      // rango completo del día local: [00:00:00, 23:59:59.999]
      const start = new Date(dto.date + 'T00:00:00.000');
      const end = new Date(dto.date + 'T23:59:59.999');
      return { start, end };
    }

    if (!dto.from || !dto.to) {
      throw new BadRequestException('from and to are required when type=RANGE');
    }

    const start = new Date(dto.from + 'T00:00:00.000');
    const end = new Date(dto.to + 'T23:59:59.999');
    if (start > end) throw new BadRequestException('from must be <= to');
    return { start, end };
  }

  async salesReport(dto: SalesReportQueryDto) {
    const { start, end } = this.buildRange(dto);

    // 1) obtener datos de warehouse + (opcional) user
    const warehouse = await this.warehouseRepo.findOne({ where: { id: dto.warehouseId } });
    if (!warehouse) throw new BadRequestException(`warehouseId ${dto.warehouseId} not found`);

    let seller: User | null = null;
    if (dto.userId) {
      seller = await this.userRepo.findOne({ where: { id: dto.userId, warehouse_id: dto.warehouseId } as any });
      if (!seller) {
        throw new BadRequestException(`userId ${dto.userId} not found in warehouseId ${dto.warehouseId}`);
      }
    }

    // 2) traer ventas (con warehouse y user para nombres)
    const qb = this.saleRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.warehouse', 'w')
      .leftJoinAndSelect('s.user', 'u')
      .where('s.warehouse_id = :warehouseId', { warehouseId: dto.warehouseId })
      .andWhere('s.sale_date BETWEEN :start AND :end', { start, end })
      .orderBy('s.sale_date', 'DESC');

    if (dto.userId) {
      qb.andWhere('s.user_id = :userId', { userId: dto.userId });
    }

    const sales = await qb.getMany();
    const saleIds = sales.map((x) => x.id);

    // Si no hay ventas, igual devolvemos cabecera útil
    if (saleIds.length === 0) {
      return {
        meta: {
          warehouse_id: warehouse.id,
          warehouse_name: warehouse.warehouse_name ?? null,
          user_id: seller?.id ?? null,
          user_name: seller?.full_name ?? null,
          start,
          end,
          total_sales: 0,
          total_amount: 0,
        },
        sales: [],
        summary_by_seller: [],
        summary_by_payment_method: [],
      };
    }

    // 3) detalles (SaleDetails) con Product y ProductSize
    const details = await this.saleDetailRepo
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.product', 'p')
      .leftJoinAndSelect('d.productSize', 'ps')
      .where('d.sale_id IN (:...saleIds)', { saleIds })
      .getMany();

    // 4) pagos (SalePayments)
    const payments = await this.salePaymentRepo
      .createQueryBuilder('sp')
      .where('sp.sale_id IN (:...saleIds)', { saleIds })
      .getMany();

    // 5) armar estructura por sale_id
    const detailsBySale = new Map<number, SaleDetail[]>();
    for (const d of details) {
      const arr = detailsBySale.get(d.sale_id) ?? [];
      arr.push(d);
      detailsBySale.set(d.sale_id, arr);
    }

    const paymentsBySale = new Map<number, SalePayment[]>();
    for (const p of payments) {
      const arr = paymentsBySale.get(p.sale_id) ?? [];
      arr.push(p);
      paymentsBySale.set(p.sale_id, arr);
    }

    // 6) formato final para el front
    const reportSales: ReportRow[] = sales.map((s) => {
      const saleDetails = (detailsBySale.get(s.id) ?? []).map((d) => {
        // ojo: decimal puede venir string, lo dejamos string
        const qty: any = d.quantity as any;
        const up: any = d.unit_price as any;

        // line_total como string (evitamos floating)
        // si ya viene string decimal, lo tratamos como number solo para producto visual (no exacto financiero).
        const lineTotal =
          typeof qty === 'string' || typeof up === 'string'
            ? (Number(qty) * Number(up)).toFixed(2)
            : (qty * up).toFixed(2);

        return {
          id: d.id,
          product_id: d.product_id,
          article_code: d.product?.article_code ?? '',
          article_description: d.product?.article_description ?? '',
          product_size_id: d.product_size_id ?? null,
          size: d.productSize?.size ?? null,
          quantity: String(d.quantity),
          unit_price: String(d.unit_price),
          line_total: String(lineTotal),
        };
      });

      const salePayments = (paymentsBySale.get(s.id) ?? []).map((p) => ({
        id: p.id,
        method: p.method,
        amount: String(p.amount),
        operation_number: p.operation_number ?? null,
        cash_received: p.cash_received === null ? null : String(p.cash_received),
        cash_change: p.cash_change === null ? null : String(p.cash_change),
        notes: p.notes ?? null,
      }));

      return {
        sale_id: s.id,
        sale_code: s.sale_code,
        sale_date: s.sale_date,

        warehouse_id: s.warehouse_id,
        warehouse_name: s.warehouse?.warehouse_name ?? warehouse.warehouse_name ?? null,

        user_id: s.user_id,
        user_name: s.user?.full_name ?? '',

        customer_id: s.customer_id ?? null,

        total_amount: String(s.total_amount),
        payment_method: s.payment_method ?? null,

        details: saleDetails,
        payments: salePayments,
      };
    });

    // 7) resúmenes útiles para el PDF/dashboard
    const summaryBySellerMap = new Map<number, { user_id: number; user_name: string; total_sales: number; total_amount: number }>();
    const summaryByPaymentMap = new Map<string, { method: string; total_amount: number; count: number }>();

    let totalAmount = 0;

    for (const s of reportSales) {
      const amt = Number(s.total_amount);
      totalAmount += isNaN(amt) ? 0 : amt;

      // por vendedor
      const prevSeller = summaryBySellerMap.get(s.user_id) ?? {
        user_id: s.user_id,
        user_name: s.user_name,
        total_sales: 0,
        total_amount: 0,
      };
      prevSeller.total_sales += 1;
      prevSeller.total_amount += isNaN(amt) ? 0 : amt;
      summaryBySellerMap.set(s.user_id, prevSeller);

      // por método (si hay SalePayments, usamos eso; si no, fallback payment_method)
      if (s.payments.length > 0) {
        for (const p of s.payments) {
          const m = p.method || 'unknown';
          const a = Number(p.amount);
          const prev = summaryByPaymentMap.get(m) ?? { method: m, total_amount: 0, count: 0 };
          prev.total_amount += isNaN(a) ? 0 : a;
          prev.count += 1;
          summaryByPaymentMap.set(m, prev);
        }
      } else {
        const m = s.payment_method || 'unknown';
        const prev = summaryByPaymentMap.get(m) ?? { method: m, total_amount: 0, count: 0 };
        prev.total_amount += isNaN(amt) ? 0 : amt;
        prev.count += 1;
        summaryByPaymentMap.set(m, prev);
      }
    }

    return {
      meta: {
        warehouse_id: warehouse.id,
        warehouse_name: warehouse.warehouse_name ?? null,
        user_id: seller?.id ?? null,
        user_name: seller?.full_name ?? null,
        start,
        end,
        total_sales: reportSales.length,
        total_amount: Number(totalAmount.toFixed(2)),
      },
      sales: reportSales,
      summary_by_seller: Array.from(summaryBySellerMap.values()).sort((a, b) => b.total_amount - a.total_amount),
      summary_by_payment_method: Array.from(summaryByPaymentMap.values()).sort((a, b) => b.total_amount - a.total_amount),
    };
  }
}
