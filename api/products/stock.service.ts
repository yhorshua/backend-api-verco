import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';

import { Stock } from '../database/entities/stock.entity';
import { StockMovement } from '../database/entities/stock-movements';
import { Sale } from '../database/entities/sale.entity';
import { SaleDetail } from '../database/entities/sale-detail.entity';
import { WarehouseSaleSequence } from '../database/entities/warehouse-sale-sequence.entity';

import { SalePayment } from '../database/entities/sale-payments.entity';
import { CashRegisterSession } from '../database/entities/cash-register-session.entity';
import { CashMovement } from '../database/entities/cash-movement.entity';

import { CreateSaleDto, PaymentMethod } from './dto/create-sale.dto';
import { ProductSize } from 'api/database/entities/product-size.entity';
import { Product } from 'api/database/entities/product.entity';

@Injectable()
export class StockService {
  constructor(
    @InjectRepository(Stock)
    private readonly stockRepo: Repository<Stock>,

    @InjectRepository(StockMovement)
    private readonly movementRepo: Repository<StockMovement>,

    @InjectRepository(Sale)
    private readonly saleRepo: Repository<Sale>,

    @InjectRepository(SaleDetail)
    private readonly saleDetailRepo: Repository<SaleDetail>,

    @InjectRepository(WarehouseSaleSequence)
    private readonly seqRepo: Repository<WarehouseSaleSequence>,

    @InjectRepository(ProductSize)
    private readonly productSizeRepo: Repository<ProductSize>,

    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    private readonly dataSource: DataSource,
  ) { }

  /**
   * ✅ Registrar venta completa:
   * - Sales
   * - SaleDetails
   * - StockMovements + decrement Stock
   * - SalePayments (detalle)
   * - CashMovements (arqueo) linkeado a SalePayments
   */
  async registerSale(dto: CreateSaleDto): Promise<{ sale: Sale; movements: StockMovement[] }> {
    if (!dto.items?.length) {
      throw new BadRequestException('La venta debe incluir al menos 1 item');
    }

    return this.dataSource.transaction(async (manager) => {
      // 0) Validar warehouse tipo "tienda"
      await this.assertWarehouseIsStore(manager, dto.warehouse_id);

      // 0.1) Debe existir caja abierta para ese warehouse + user
      const sessionId = await this.requireOpenCashSession(manager, dto.warehouse_id, dto.user_id);

      // 1) Correlativo por tienda
      const sale_code = await this.getNextSaleCode(manager, dto.warehouse_id);

      // 2) Validar stock + calcular total real con BD
      const { validated, total_amount } = await this.validateStockAndComputeTotal(manager, dto);

      // 3) Crear venta
      const sale = await this.createSaleHeader(manager, dto, sale_code, total_amount);

      // 4) Crear detalles + movimientos + descontar stock
      const stockMovements = await this.createDetailsAndStockOutputs(manager, dto, sale, validated);

      // 5) Crear SalePayments (detalle de pago) y validar vs total real
      const payments = await this.createSalePayments(manager, dto, sale);

      // 6) Crear CashMovements para arqueo (uno por cada SalePayment con amount > 0)
      await this.createCashMovementsFromPayments(manager, sessionId, dto, sale, payments);

      return { sale, movements: stockMovements };
    });
  }

  // =========================================================
  // Helpers (modular)
  // =========================================================

  private async assertWarehouseIsStore(manager: EntityManager, warehouseId: number) {
    const warehouseRows = await manager.query(
      `SELECT id, type FROM Warehouses WHERE id = ? LIMIT 1`,
      [warehouseId],
    );

    if (!warehouseRows.length) {
      throw new NotFoundException(`Warehouse con id=${warehouseId} no existe`);
    }

    if (warehouseRows[0].type !== 'tienda') {
      throw new BadRequestException(
        `Solo warehouses tipo "tienda" pueden registrar ventas. warehouse_id=${warehouseId}`,
      );
    }
  }

  /**
   * Caja abierta por warehouse + user
   */
  private async requireOpenCashSession(
    manager: EntityManager,
    warehouseId: number,
    userId: number,
  ): Promise<number> {
    // FOR UPDATE para evitar carreras si cierran/abren en paralelo
    const rows = await manager.query(
      `SELECT id
       FROM CashRegisterSessions
       WHERE warehouse_id = ? AND status = 'OPEN'
       ORDER BY opened_at DESC
       LIMIT 1
       FOR UPDATE`,
      [warehouseId, userId],
    );

    if (!rows.length) {
      throw new BadRequestException(
        `No hay caja abierta para warehouse_id=${warehouseId} y user_id=${userId}. Debes abrir caja antes de vender.`,
      );
    }

    return Number(rows[0].id);
  }

  private async validateStockAndComputeTotal(manager: EntityManager, dto: CreateSaleDto) {
    let total_amount = 0;

    const validated: Array<{
      item: {
        product_id: number;
        product_size_id?: number;
        quantity: number;
        unit_of_measure: string;
      };
      unit_price: number;
    }> = [];

    for (const item of dto.items) {
      const where: any = {
        warehouse_id: dto.warehouse_id,
        product_id: item.product_id,
        product_size_id: item.product_size_id ?? null,
      };

      const stock = await manager.findOne(Stock, {
        where,
        relations: ['product'],
      });

      if (!stock) {
        throw new NotFoundException(
          `No existe stock para product_id=${item.product_id}, size=${item.product_size_id ?? 'N/A'} en warehouse=${dto.warehouse_id}`,
        );
      }

      if (Number(stock.quantity) < Number(item.quantity)) {
        throw new NotFoundException(
          `Stock insuficiente: product_id=${item.product_id}, size=${item.product_size_id ?? 'N/A'} (disp=${stock.quantity}, req=${item.quantity})`,
        );
      }

      const unit_price = Number(item.unit_price);
      total_amount += Number(item.quantity) * unit_price;

      validated.push({ item, unit_price });
    }

    total_amount = Number(total_amount.toFixed(2));
    return { validated, total_amount };
  }

  private async createSaleHeader(
    manager: EntityManager,
    dto: CreateSaleDto,
    sale_code: string,
    total_amount: number,
  ) {
    const sale = manager.create(Sale, {
      sale_code,
      warehouse_id: dto.warehouse_id,
      user_id: dto.user_id,
      customer_id: dto.customer_id,
      total_amount,
      payment_method: dto.payment_method,
    });

    await manager.save(Sale, sale);
    return sale;
  }

  private async createDetailsAndStockOutputs(
    manager: EntityManager,
    dto: CreateSaleDto,
    sale: Sale,
    validated: Array<{ item: any; unit_price: number }>,
  ): Promise<StockMovement[]> {
    const movements: StockMovement[] = [];

    for (const { item, unit_price } of validated) {
      // detalle
      const detail = manager.create(SaleDetail, {
        sale_id: sale.id,
        product_id: item.product_id,
        product_size_id: item.product_size_id ?? null,
        quantity: item.quantity,
        unit_price,
      });
      await manager.save(SaleDetail, detail);

      // movimiento stock
      const movement = manager.create(StockMovement, {
        warehouse_id: dto.warehouse_id,
        product_id: item.product_id,
        product_size_id: item.product_size_id ?? null,
        quantity: -Math.abs(Number(item.quantity)),
        unit_of_measure: item.unit_of_measure,
        movement_type: 'salida',
        reference: `Venta ${sale.sale_code}`,
        user_id: dto.user_id,
      });
      await manager.save(StockMovement, movement);
      movements.push(movement);

      // descontar stock
      await manager.decrement(
        Stock,
        {
          warehouse_id: dto.warehouse_id,
          product_id: item.product_id,
          product_size_id: item.product_size_id ?? null,
        },
        'quantity',
        item.quantity,
      );
    }

    return movements;
  }

  /**
   * ✅ Crea SalePayments y valida con el total real (sale.total_amount)
   * - efectivo: 1 fila
   * - yape/plin/tarjetas: 1 fila
   * - yapeEfectivo: 2 filas
   * - obsequio: 1 fila amount=0 con notes
   */
  private async createSalePayments(
    manager: EntityManager,
    dto: CreateSaleDto,
    sale: Sale,
  ): Promise<SalePayment[]> {
    const total = Number(sale.total_amount);
    const p: any = dto.payment || {};

    const payments: SalePayment[] = [];

    const savePayment = async (payload: Partial<SalePayment>) => {
      const pay = manager.create(SalePayment, payload);
      await manager.save(SalePayment, pay);
      payments.push(pay);
    };

    if (dto.payment_method === 'efectivo') {
      const efectivoEntregado = Number(p.efectivoEntregado ?? NaN);
      if (!Number.isFinite(efectivoEntregado)) {
        throw new BadRequestException('Falta efectivoEntregado para pago en efectivo');
      }
      if (efectivoEntregado < total) {
        throw new BadRequestException(`Efectivo entregado (${efectivoEntregado}) es menor que total (${total})`);
      }
      const vuelto = Number((efectivoEntregado - total).toFixed(2));

      await savePayment({
        sale_id: sale.id,
        method: 'efectivo',
        amount: total,
        cash_received: efectivoEntregado,
        cash_change: vuelto,
        notes: null,
      });

      return payments;
    }

    if (dto.payment_method === 'yape' || dto.payment_method === 'plin'
      || dto.payment_method === 'tarjetaDebito' || dto.payment_method === 'tarjetaCredito') {
      const op = String(p.numeroOperacion ?? '').trim();
      if (op.length < 6) {
        throw new BadRequestException('numeroOperacion inválido (mín 6 caracteres) para pagos digitales/tarjeta');
      }

      await savePayment({
        sale_id: sale.id,
        method: dto.payment_method,
        amount: total,
        operation_number: op,
        cash_received: null,
        cash_change: null,
        notes: null,
      });

      return payments;
    }

    if (dto.payment_method === 'yapeEfectivo') {
      const yapeMonto = Number(p.yapeMonto ?? NaN);
      const yapeOp = String(p.yapeOperacion ?? '').trim();
      const efectivoEntregadoMixto = Number(p.efectivoEntregadoMixto ?? NaN);

      if (!Number.isFinite(yapeMonto) || yapeMonto <= 0) {
        throw new BadRequestException('yapeMonto inválido para pago mixto');
      }
      if (yapeMonto >= total) {
        throw new BadRequestException(`yapeMonto (${yapeMonto}) debe ser menor que total (${total}) en pago mixto`);
      }
      if (yapeOp.length < 6) {
        throw new BadRequestException('yapeOperacion inválida (mín 6 caracteres) para pago mixto');
      }
      if (!Number.isFinite(efectivoEntregadoMixto)) {
        throw new BadRequestException('Falta efectivoEntregadoMixto para pago mixto');
      }

      const efectivoParte = Number((total - yapeMonto).toFixed(2));
      if (efectivoEntregadoMixto < efectivoParte) {
        throw new BadRequestException(
          `Efectivo entregado mixto (${efectivoEntregadoMixto}) es menor que la parte efectivo (${efectivoParte})`,
        );
      }
      const vueltoMixto = Number((efectivoEntregadoMixto - efectivoParte).toFixed(2));

      // Fila Yape
      await savePayment({
        sale_id: sale.id,
        method: 'yape',
        amount: Number(yapeMonto.toFixed(2)),
        operation_number: yapeOp,
        cash_received: null,
        cash_change: null,
        notes: 'Pago mixto (Yape)',
      });

      // Fila Efectivo
      await savePayment({
        sale_id: sale.id,
        method: 'efectivo',
        amount: efectivoParte,
        cash_received: efectivoEntregadoMixto,
        cash_change: vueltoMixto,
        notes: 'Pago mixto (Efectivo)',
      });

      return payments;
    }

    if (dto.payment_method === 'obsequio') {
      const motivo = String(p.motivoObsequio ?? '').trim();
      if (motivo.length < 5) {
        throw new BadRequestException('motivoObsequio inválido (mín 5 caracteres)');
      }
      const autorizadoPor = String(p.autorizadoPor ?? '').trim();
      const notes = autorizadoPor ? `Motivo: ${motivo} | Autorizado: ${autorizadoPor}` : `Motivo: ${motivo}`;

      await savePayment({
        sale_id: sale.id,
        method: 'obsequio',
        amount: 0,
        cash_received: null,
        cash_change: null,
        notes,
      });

      return payments;
    }

    throw new BadRequestException(`payment_method no soportado: ${dto.payment_method as PaymentMethod}`);
  }

  /**
   * ✅ Crea CashMovements a partir de SalePayments (para arqueo)
   * - 1 movimiento por payment con amount > 0
   * - referencia a Sale + SalePayment
   */
  private async createCashMovementsFromPayments(
    manager: EntityManager,
    sessionId: number,
    dto: CreateSaleDto,
    sale: Sale,
    payments: SalePayment[],
  ) {
    for (const pay of payments) {
      // obsequio (amount 0) no entra a caja
      const amount = Number(pay.amount);
      if (!amount || amount <= 0) continue;

      const cm = manager.create(CashMovement, {
        session_id: sessionId,
        warehouse_id: dto.warehouse_id,
        user_id: dto.user_id,

        type: 'SALE',
        payment_method: pay.method,
        amount: Number(amount.toFixed(2)),
        operation_number: pay.operation_number ?? null,

        reference_sale_id: sale.id,
        reference_sale_payment_id: pay.id,

        description: `Venta ${sale.sale_code}`,
      });

      await manager.save(CashMovement, cm);
    }
  }

  /**
   * 🔒 Genera el siguiente V00001 por tienda
   */
  private async getNextSaleCode(manager: EntityManager, warehouseId: number): Promise<string> {
    let rows = await manager.query(
      `SELECT last_number FROM WarehouseSaleSequence WHERE warehouse_id = ? FOR UPDATE`,
      [warehouseId],
    );

    if (!rows.length) {
      await manager.query(
        `INSERT IGNORE INTO WarehouseSaleSequence (warehouse_id, last_number) VALUES (?, 0)`,
        [warehouseId],
      );

      rows = await manager.query(
        `SELECT last_number FROM WarehouseSaleSequence WHERE warehouse_id = ? FOR UPDATE`,
        [warehouseId],
      );

      if (!rows.length) {
        throw new NotFoundException(`No se pudo inicializar secuencia para warehouse_id=${warehouseId}`);
      }
    }

    const next = Number(rows[0].last_number) + 1;

    await manager.query(
      `UPDATE WarehouseSaleSequence SET last_number = ? WHERE warehouse_id = ?`,
      [next, warehouseId],
    );

    return `V${String(next).padStart(5, '0')}`;
  }

  // =========================================================
  // Tu método existente (sin cambios)
  // =========================================================

  async getProductStockByWarehouseAndArticleCode(warehouseId: number, articleCode: string) {
    const code = (articleCode || '').trim().toUpperCase();
    if (!code) throw new BadRequestException('articleCode es requerido');

    const rows = await this.stockRepo
      .createQueryBuilder('s')
      .innerJoinAndSelect('s.product', 'p')
      .leftJoinAndSelect('s.productSize', 'ps')
      .leftJoinAndSelect('p.series', 'series')
      .leftJoinAndSelect('p.sizes', 'sizes')
      .where('s.warehouse_id = :warehouseId', { warehouseId })
      .andWhere('p.status = 1')
      .andWhere('UPPER(p.article_code) = :code', { code })
      .orderBy('ps.size', 'ASC')
      .getMany();

    if (!rows.length) {
      throw new NotFoundException(
        `No hay stock para warehouse=${warehouseId} y article_code=${code}`,
      );
    }

    const p = rows[0].product;

    return {
      product_id: p.id,
      article_code: p.article_code,
      article_description: p.article_description,
      article_series: p.article_series,
      type_origin: p.type_origin,
      manufacturing_cost: Number(p.manufacturing_cost),
      unit_price: Number(p.unit_price),
      brand_name: p.brand_name,
      model_code: p.model_code,
      category: p.category,
      material_type: p.material_type,
      color: p.color,
      stock_minimum: p.stock_minimum,
      product_image: p.product_image,
      status: p.status,
      created_at: p.created_at,

      series: p.series ?? null,
      sizes: p.sizes ?? [],

      stock: rows.map((s) => ({
        stock_id: s.id,
        warehouse_id: s.warehouse_id,
        product_id: s.product_id,
        product_size_id: s.product_size_id,
        size: s.productSize?.size ?? null,
        quantity: Number(s.quantity),
        unit_of_measure: s.unit_of_measure,
      })),

      saldo_total: rows.reduce((acc, s) => acc + Number(s.quantity || 0), 0),
    };
  }

  async registerStockForMultipleItems(
    warehouseId: number,
    products: { productId: number; productSizeId: number; quantity: number }[]
  ): Promise<Stock[]> {
    const updatedStocks: Stock[] = [];

    // Iteramos sobre cada producto
    for (const item of products) {
      const { productId, productSizeId, quantity } = item;

      // Verificamos si el producto existe
      const product = await this.productRepo.findOne({ where: { id: productId } });
      if (!product) {
        throw new NotFoundException(`Producto con ID ${productId} no encontrado`);
      }

      // Verificamos si la talla existe usando el productSizeId
      const productSize = await this.productSizeRepo.findOne({
        where: { id: productSizeId, product: { id: productId } }, // Buscamos la talla para el producto específico
      });
      if (!productSize) {
        throw new NotFoundException(`Talla con ID ${productSizeId} no encontrada para el producto ${productId}`);
      }

      // Verificamos si ya existe stock para ese producto y talla en el almacén
      let stock = await this.stockRepo.findOne({
        where: {
          warehouse_id: warehouseId,
          product_id: productId,
          product_size_id: productSize.id,
        },
      });

      if (stock) {
        // Si el stock ya existe, sumamos la cantidad
        stock.quantity += quantity;
        updatedStocks.push(await this.stockRepo.save(stock));  // Guardamos el stock actualizado
      } else {
        // Si el stock no existe, lo creamos
        stock = this.stockRepo.create({
          warehouse_id: warehouseId,
          product_id: productId,
          product_size_id: productSize.id,
          quantity,
        });
        updatedStocks.push(await this.stockRepo.save(stock));  // Guardamos el nuevo stock
      }
    }

    return updatedStocks;
  }
}
