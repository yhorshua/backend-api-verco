import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  DataSource,
  EntityManager,
  Brackets,
  In,
} from 'typeorm';

import { Stock } from '../database/entities/stock.entity';
import { StockMovement } from '../database/entities/stock-movements';
import { Sale } from '../database/entities/sale.entity';
import { SaleDetail } from '../database/entities/sale-detail.entity';
import { WarehouseSaleSequence } from '../database/entities/warehouse-sale-sequence.entity';

import { SalePayment } from '../database/entities/sale-payments.entity';
import { CashRegisterSession } from '../database/entities/cash-register-session.entity';
import { CashMovement } from '../database/entities/cash-movement.entity';

import { CreateSaleDto, PaymentMethod } from './dto/create-sale.dto';
import { ProductSize } from 'src/database/entities/product-size.entity';
import { Product } from 'src/database/entities/product.entity';
import moment, { now } from 'moment-timezone';
import { UpdateProductDto } from './dto/create-product.dto';

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

      const fechaLima = moment().tz('America/Lima').format('YYYY-MM-DD HH:mm:ss');
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

  private async validateStockAndComputeTotal(
    manager: EntityManager,
    dto: CreateSaleDto,
  ) {
    let total_amount = 0;

    const normalizedItems = dto.items.map((item) => ({
      ...item,
      product_id: Number(item.product_id),
      product_size_id: item.product_size_id ? Number(item.product_size_id) : null,
      quantity: Number(item.quantity),
      unit_price: Number(item.unit_price),
      unit_of_measure: item.unit_of_measure ?? 'PAR',
    }));

    const stocks = await manager
      .getRepository(Stock)
      .createQueryBuilder('stock')
      .innerJoinAndSelect('stock.product', 'product')
      .where('stock.warehouse_id = :warehouseId', {
        warehouseId: dto.warehouse_id,
      })
      .andWhere(
        new Brackets((qb) => {
          normalizedItems.forEach((item, index) => {
            qb.orWhere(
              `(stock.product_id = :productId${index} AND stock.product_size_id ${item.product_size_id === null
                ? `IS NULL`
                : `= :productSizeId${index}`
              })`,
              {
                [`productId${index}`]: item.product_id,
                [`productSizeId${index}`]: item.product_size_id,
              },
            );
          });
        }),
      )
      .setLock('pessimistic_write')
      .getMany();

    const stockMap = new Map<string, Stock>();

    for (const stock of stocks) {
      const key = `${stock.product_id}-${stock.product_size_id ?? 'null'}`;
      stockMap.set(key, stock);
    }

    const validated: Array<{
      item: {
        product_id: number;
        product_size_id: number | null;
        quantity: number;
        unit_price: number;
        unit_of_measure: string;
      };
      stock: Stock;
      previous_quantity: number;
      new_quantity: number;
      unit_price: number;
      factory_price_at_sale: number;
    }> = [];

    for (const item of normalizedItems) {
      const key = `${item.product_id}-${item.product_size_id ?? 'null'}`;
      const stock = stockMap.get(key);

      if (!stock) {
        throw new NotFoundException(
          `No existe stock para product_id=${item.product_id}, size=${item.product_size_id ?? 'N/A'} en warehouse=${dto.warehouse_id}`,
        );
      }

      if (!stock.product) {
        throw new NotFoundException(
          `Producto no encontrado para product_id=${item.product_id}`,
        );
      }

      const previousQuantity = Number(stock.quantity);
      const quantityToSubtract = Math.abs(Number(item.quantity));
      const newQuantity = Number(
        (previousQuantity - quantityToSubtract).toFixed(2),
      );

      if (newQuantity < 0) {
        throw new BadRequestException(
          `Stock insuficiente para product_id=${item.product_id}, size=${item.product_size_id ?? 'N/A'} (disp=${previousQuantity}, req=${quantityToSubtract})`,
        );
      }

      const unit_price = Number(item.unit_price);
      const factory_price_at_sale = Number(stock.product.factory_price ?? 0);

      if (!Number.isFinite(unit_price) || unit_price < 0) {
        throw new BadRequestException(
          `Precio unitario inválido para product_id=${item.product_id}`,
        );
      }

      if (!Number.isFinite(factory_price_at_sale)) {
        throw new BadRequestException(
          `Precio de fábrica inválido para product_id=${item.product_id}`,
        );
      }

      total_amount += quantityToSubtract * unit_price;

      validated.push({
        item,
        stock,
        previous_quantity: previousQuantity,
        new_quantity: newQuantity,
        unit_price,
        factory_price_at_sale,
      });
    }

    total_amount = Number(total_amount.toFixed(2));

    return {
      validated,
      total_amount,
    };
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
      sale_date: new Date(),
    });

    await manager.save(Sale, sale);
    return sale;
  }

  private async createDetailsAndStockOutputs(
    manager: EntityManager,
    dto: CreateSaleDto,
    sale: Sale,
    validated: Array<{
      item: {
        product_id: number;
        product_size_id: number | null;
        quantity: number;
        unit_price: number;
        unit_of_measure: string;
      };
      stock: Stock;
      previous_quantity: number;
      new_quantity: number;
      unit_price: number;
      factory_price_at_sale: number;
    }>,
  ): Promise<StockMovement[]> {
    const movementsToSave: StockMovement[] = [];
    const stocksToUpdate: Stock[] = [];

    for (const row of validated) {
      const quantityToSubtract = Math.abs(Number(row.item.quantity));

      const movement = manager.create(StockMovement, {
        warehouse_id: dto.warehouse_id,
        product_id: row.item.product_id,
        product_size_id: row.item.product_size_id,

        quantity: -quantityToSubtract,
        previous_quantity: row.previous_quantity,
        new_quantity: row.new_quantity,

        unit_of_measure: row.item.unit_of_measure ?? 'PAR',
        movement_type: 'salida',

        reference_id: sale.id,
        reference_type: 'VENTA',
        reference: sale.sale_code,

        notes: `Salida de stock por venta ${sale.sale_code}. Stock anterior: ${row.previous_quantity}. Cantidad vendida: ${quantityToSubtract}. Stock nuevo: ${row.new_quantity}.`,

        user_id: dto.user_id,
        created_at: new Date(),
      });

      movementsToSave.push(movement);

      row.stock.quantity = row.new_quantity;
      stocksToUpdate.push(row.stock);
    }

    const savedMovements = await manager.save(StockMovement, movementsToSave);

    const detailsToSave = validated.map((row, index) =>
      manager.create(SaleDetail, {
        sale_id: sale.id,
        product_id: row.item.product_id,
        product_size_id: row.item.product_size_id,
        quantity: Number(row.item.quantity),
        unit_price: Number(row.unit_price),
        factory_price_at_sale: Number(row.factory_price_at_sale),
        stock_movement_id: savedMovements[index].id,
      }),
    );

    await manager.save(SaleDetail, detailsToSave);

    await manager.save(Stock, stocksToUpdate);

    return savedMovements;
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
        created_at: new Date(),
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
        created_at: new Date(),
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
        created_at: new Date(),
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

  async getProductStockByWarehouseAndArticleCode(
    warehouseId: number,
    articleCode: string,
  ) {
    const code = (articleCode || '').trim().toUpperCase();

    if (!code) {
      throw new BadRequestException('articleCode es requerido');
    }

    /**
     * 1. Buscar producto una sola vez.
     * OJO:
     * Evitamos UPPER(p.article_code) para que pueda usar índice.
     * Lo ideal es que article_code se guarde siempre en mayúsculas.
     */
    const product = await this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.series', 'series')
      .leftJoinAndSelect('p.category', 'category')
      .leftJoinAndSelect('p.sizes', 'sizes')
      .where('p.article_code COLLATE utf8mb4_general_ci = :code', { code })
      .andWhere('p.status = :status', { status: true })
      .getOne();

    if (!product) {
      throw new NotFoundException(`Producto con article_code=${code} no encontrado`);
    }

    /**
     * 2. Buscar stock solo por warehouse + product_id.
     * Esta consulta debe ser rápida con índice:
     * Stock(warehouse_id, product_id, product_size_id)
     */
    const stockRows = await this.stockRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.productSize', 'ps')
      .where('s.warehouse_id = :warehouseId', { warehouseId })
      .andWhere('s.product_id = :productId', { productId: product.id })
      .orderBy('CAST(ps.size AS UNSIGNED)', 'ASC')
      .addOrderBy('ps.size', 'ASC')
      .getMany();

    if (!stockRows.length) {
      throw new NotFoundException(
        `No hay stock para warehouse=${warehouseId} y article_code=${code}`,
      );
    }

    return {
      product_id: product.id,
      article_code: product.article_code,
      article_description: product.article_description,
      article_series: product.article_series,
      type_origin: product.type_origin,
      manufacturing_cost: Number(product.manufacturing_cost),
      unit_price: Number(product.unit_price),
      brand_name: product.brand_name,
      model_code: product.model_code,
      category: product.category,
      material_type: product.material_type,
      color: product.color,
      stock_minimum: product.stock_minimum,
      product_image: product.product_image,
      status: product.status,
      created_at: product.created_at,

      series: product.series ?? null,
      sizes: product.sizes ?? [],

      stock: stockRows.map((s) => ({
        stock_id: s.id,
        warehouse_id: s.warehouse_id,
        product_id: s.product_id,
        product_size_id: s.product_size_id,
        size: s.productSize?.size ?? null,
        quantity: Number(s.quantity),
        unit_of_measure: s.unit_of_measure,
      })),

      saldo_total: stockRows.reduce(
        (acc, s) => acc + Number(s.quantity || 0),
        0,
      ),
    };
  }

  async registerStockForMultipleItems(
    warehouseId: number,
    products: {
      productId: number;
      productSizeId: number;
      quantity: number;
    }[],
    userId: number,
    guideId?: number,
    guideNumber?: string,
  ): Promise<{
    stocks: Stock[];
    movements: StockMovement[];
  }> {
    if (!products?.length) {
      throw new BadRequestException('Debe enviar al menos un producto');
    }

    return this.dataSource.transaction(async (manager) => {
      const stockRepo = manager.getRepository(Stock);
      const productRepo = manager.getRepository(Product);
      const productSizeRepo = manager.getRepository(ProductSize);
      const stockMovementRepo = manager.getRepository(StockMovement);

      const groupedMap = new Map<
        string,
        {
          productId: number;
          productSizeId: number;
          quantity: number;
        }
      >();

      for (const item of products) {
        const productId = Number(item.productId);
        const productSizeId = Number(item.productSizeId);
        const quantity = Number(item.quantity);

        if (!Number.isFinite(productId) || productId <= 0) {
          throw new BadRequestException('productId inválido');
        }

        if (!Number.isFinite(productSizeId) || productSizeId <= 0) {
          throw new BadRequestException('productSizeId inválido');
        }

        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new BadRequestException('La cantidad debe ser mayor a 0');
        }

        const key = `${productId}-${productSizeId}`;
        const existing = groupedMap.get(key);

        if (existing) {
          existing.quantity = Number((existing.quantity + quantity).toFixed(2));
        } else {
          groupedMap.set(key, {
            productId,
            productSizeId,
            quantity,
          });
        }
      }

      const groupedItems = Array.from(groupedMap.values());

      const productIds = [...new Set(groupedItems.map((item) => item.productId))];
      const productSizeIds = [
        ...new Set(groupedItems.map((item) => item.productSizeId)),
      ];

      const existingProducts = await productRepo.find({
        where: {
          id: In(productIds),
        },
        select: {
          id: true,
        },
      });

      const existingProductIds = new Set(existingProducts.map((p) => p.id));

      for (const productId of productIds) {
        if (!existingProductIds.has(productId)) {
          throw new NotFoundException(`Producto con ID ${productId} no encontrado`);
        }
      }

      const productSizes = await productSizeRepo
        .createQueryBuilder('ps')
        .select('ps.id', 'id')
        .addSelect('ps.product_id', 'product_id')
        .where('ps.id IN (:...productSizeIds)', { productSizeIds })
        .getRawMany();

      const sizeMap = new Map<string, any>();

      for (const size of productSizes) {
        const productId = Number(size.product_id);
        const productSizeId = Number(size.id);

        const key = `${productId}-${productSizeId}`;
        sizeMap.set(key, size);
      }

      for (const item of groupedItems) {
        const key = `${item.productId}-${item.productSizeId}`;

        if (!sizeMap.has(key)) {
          throw new NotFoundException(
            `Talla con ID ${item.productSizeId} no encontrada para el producto ${item.productId}`,
          );
        }
      }

      const stocks = await stockRepo
        .createQueryBuilder('stock')
        .where('stock.warehouse_id = :warehouseId', { warehouseId })
        .andWhere(
          new Brackets((qb) => {
            groupedItems.forEach((item, index) => {
              qb.orWhere(
                `(stock.product_id = :productId${index} AND stock.product_size_id = :productSizeId${index})`,
                {
                  [`productId${index}`]: item.productId,
                  [`productSizeId${index}`]: item.productSizeId,
                },
              );
            });
          }),
        )
        .setLock('pessimistic_write')
        .getMany();

      const stockMap = new Map<string, Stock>();

      for (const stock of stocks) {
        const key = `${stock.product_id}-${stock.product_size_id}`;
        stockMap.set(key, stock);
      }

      const stocksToSave: Stock[] = [];
      const movementsToSave: StockMovement[] = [];

      for (const item of groupedItems) {
        const key = `${item.productId}-${item.productSizeId}`;
        let stock = stockMap.get(key);

        const previousQuantity = stock ? Number(stock.quantity) : 0;
        const newQuantity = Number(
          (previousQuantity + Number(item.quantity)).toFixed(2),
        );

        if (stock) {
          stock.quantity = newQuantity;
        } else {
          stock = stockRepo.create({
            warehouse_id: warehouseId,
            product_id: item.productId,
            product_size_id: item.productSizeId,
            unit_of_measure: 'PAR',
            quantity: newQuantity,
          });
        }

        stocksToSave.push(stock);

        const movement = stockMovementRepo.create({
          warehouse_id: warehouseId,
          product_id: item.productId,
          product_size_id: item.productSizeId,

          quantity: Number(item.quantity),
          previous_quantity: previousQuantity,
          new_quantity: newQuantity,

          unit_of_measure: 'PAR',
          movement_type: 'entrada',

          reference_id: guideId ?? null,
          reference_type: guideId || guideNumber ? 'GUIA' : null,
          reference: guideNumber ?? null,

          notes: `Ingreso de stock por guía ${guideNumber ?? guideId ?? 'SIN GUÍA'
            }. Stock anterior: ${previousQuantity}. Cantidad ingresada: ${item.quantity
            }. Stock nuevo: ${newQuantity}.`,

          user_id: userId,
          created_at: new Date(),
        });

        movementsToSave.push(movement);
      }

      const savedStocks = await stockRepo.save(stocksToSave);
      const savedMovements = await stockMovementRepo.save(movementsToSave);

      return {
        stocks: savedStocks,
        movements: savedMovements,
      };
    });
  }

  async getInventoryByWarehouseAndCategory(
    warehouseId: number,
    categoryId: number,
  ) {
    const rows = await this.stockRepo
      .createQueryBuilder('s')
      .innerJoinAndSelect('s.product', 'p')
      .innerJoin('p.category', 'c') // 👈 JOIN a categoría
      .leftJoinAndSelect('s.productSize', 'ps')
      .leftJoinAndSelect('p.sizes', 'sizes')
      .where('s.warehouse_id = :warehouseId', { warehouseId })
      .andWhere('c.id = :categoryId', { categoryId }) // 👈 FILTRO REAL
      .andWhere('p.status = 1')
      .orderBy('p.article_code', 'ASC')
      .addOrderBy('ps.size', 'ASC')
      .getMany();

    if (!rows.length) {
      throw new NotFoundException(
        `No hay productos para warehouse=${warehouseId} y categoría=${categoryId}`,
      );
    }

    // Agrupar por producto
    const map = new Map<number, any>();

    for (const s of rows) {
      const p = s.product;

      if (!map.has(p.id)) {
        map.set(p.id, {
          product_id: p.id,
          article_code: p.article_code,
          article_description: p.article_description,
          brand_name: p.brand_name,
          model_code: p.model_code,
          category: p.category,
          color: p.color,
          unit_price: Number(p.unit_price),
          product_image: p.product_image,
          sizes: p.sizes ?? [],
          stock: [],
          total_stock: 0,
        });
      }

      const prod = map.get(p.id);

      prod.stock.push({
        stock_id: s.id,
        product_size_id: s.product_size_id,
        size: s.productSize?.size ?? null,
        quantity: Number(s.quantity),
      });

      prod.total_stock += Number(s.quantity || 0);
    }

    return Array.from(map.values());
  }

  async adjustInventory(
    warehouseId: number,
    userId: number,
    items: {
      product_id: number;
      product_size_id: number;
      new_quantity: number;
    }[],
  ) {
    return this.dataSource.transaction(async (manager) => {
      const movements: StockMovement[] = [];

      for (const item of items) {
        const stock = await manager.findOne(Stock, {
          where: {
            warehouse_id: warehouseId,
            product_id: item.product_id,
            product_size_id: item.product_size_id,
          },
        });

        if (!stock) {
          throw new NotFoundException(
            `Stock no encontrado para product_id=${item.product_id}, size=${item.product_size_id}`,
          );
        }

        const previousQuantity = Number(stock.quantity);
        const newQuantity = Number(item.new_quantity);
        const difference = Number((newQuantity - previousQuantity).toFixed(2));

        if (difference === 0) continue;

        const movement = manager.create(StockMovement, {
          warehouse_id: warehouseId,
          product_id: item.product_id,
          product_size_id: item.product_size_id,

          quantity: difference,
          previous_quantity: previousQuantity,
          new_quantity: newQuantity,

          unit_of_measure: 'PAR',
          movement_type: 'ajuste',

          reference_id: null,
          reference_type: 'AJUSTE',
          reference: 'Ajuste de inventario',

          notes: `Ajuste de inventario. Stock anterior: ${previousQuantity}. Stock nuevo: ${newQuantity}. Diferencia: ${difference}.`,

          user_id: userId,
          created_at: new Date(),
        });

        const savedMovement = await manager.save(StockMovement, movement);

        movements.push(savedMovement);

        stock.quantity = newQuantity;
        await manager.save(Stock, stock);
      }

      return {
        message: 'Inventario actualizado correctamente',
        movements,
      };
    });
  }
}
