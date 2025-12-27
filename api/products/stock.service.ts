import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';

import { Stock } from '../database/entities/stock.entity';
import { StockMovement } from '../database/entities/stock-movements';
import { Sale } from '../database/entities/sale.entity';
import { SaleDetail } from '../database/entities/sale-detail.entity';
import { WarehouseSaleSequence } from '../database/entities/warehouse-sale-sequence.entity';
import { CreateSaleDto } from './dto/create-sale.dto';

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

    private readonly dataSource: DataSource,
  ) {}

  /**
   * ✅ Registrar venta con múltiples items + correlativo por tienda (V00001)
   */
  async registerSale(dto: CreateSaleDto): Promise<{ sale: Sale; movements: StockMovement[] }> {
    if (!dto.items?.length) {
      throw new BadRequestException('La venta debe incluir al menos 1 item');
    }

    return this.dataSource.transaction(async (manager) => {
      // 1) Validar que el warehouse exista y sea tipo "tienda"
      const warehouseRows = await manager.query(
        `SELECT id, type FROM Warehouses WHERE id = ? LIMIT 1`,
        [dto.warehouse_id],
      );

      if (!warehouseRows.length) {
        throw new NotFoundException(`Warehouse con id=${dto.warehouse_id} no existe`);
      }

      if (warehouseRows[0].type !== 'tienda') {
        throw new BadRequestException(
          `Solo warehouses tipo "tienda" pueden registrar ventas. warehouse_id=${dto.warehouse_id}`,
        );
      }

      // 2) Generar correlativo por tienda (V00001)
      const sale_code = await this.getNextSaleCode(manager, dto.warehouse_id);

      // 3) Validar stock y calcular total
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
        // Manejo correcto de talla NULL
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

        const unit_price = Number(stock.product.unit_price);
        total_amount += Number(item.quantity) * unit_price;

        validated.push({ item, unit_price });
      }

      // 4) Crear cabecera de venta
      const sale = manager.create(Sale, {
        sale_code,
        warehouse_id: dto.warehouse_id,
        user_id: dto.user_id,
        customer_id: dto.customer_id,
        total_amount: Number(total_amount.toFixed(2)),
        payment_method: dto.payment_method,
      });

      await manager.save(Sale, sale);

      // 5) Crear detalles + movimientos + descontar stock
      const movements: StockMovement[] = [];

      for (const { item, unit_price } of validated) {
        // 5.1 Detalle de venta
        const detail = manager.create(SaleDetail, {
          sale_id: sale.id,
          product_id: item.product_id,
          product_size_id: item.product_size_id ?? null,
          quantity: item.quantity,
          unit_price: unit_price,
        });
        await manager.save(SaleDetail, detail);

        // 5.2 Movimiento de stock (salida)
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

        // 5.3 Descontar stock
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

      return { sale, movements };
    });
  }

  /**
   * 🔒 Genera el siguiente V00001 por tienda
   * - FOR UPDATE bloquea la fila de esa tienda
   * - INSERT IGNORE evita errores si dos ventas intentan crear la secuencia a la vez
   */
  private async getNextSaleCode(manager: EntityManager, warehouseId: number): Promise<string> {
    // Bloquea SOLO la fila de esa tienda (si existe)
    let rows = await manager.query(
      `SELECT last_number FROM WarehouseSaleSequence WHERE warehouse_id = ? FOR UPDATE`,
      [warehouseId],
    );

    // Si no existe, créala de forma segura (concurrencia)
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

  async getProductStockByWarehouseAndArticleCode(
  warehouseId: number,
  articleCode: string,
) {
  const code = (articleCode || '').trim().toUpperCase();
  if (!code) throw new BadRequestException('articleCode es requerido');

  // Trae SOLO stock de ese warehouse y ese producto (por article_code)
  const rows = await this.stockRepo
    .createQueryBuilder('s')
    .innerJoinAndSelect('s.product', 'p')
    .leftJoinAndSelect('s.productSize', 'ps')
    .leftJoinAndSelect('p.series', 'series')
    .leftJoinAndSelect('p.sizes', 'sizes') // catálogo de tallas del producto (opcional)
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

  // Armado de respuesta "amigable" para frontend
  return {
    product_id: p.id,
    article_code: p.article_code,
    article_description: p.article_description,
    article_series: p.article_series,
    type_origin: p.type_origin,
    manufacturing_cost: Number(p.manufacturing_cost), // costo fabricación/compra
    unit_price: Number(p.unit_price),                 // precio venta
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
      size: s.productSize?.size ?? null, // "27","28"... (string)
      quantity: Number(s.quantity),
      unit_of_measure: s.unit_of_measure,
    })),

    // útil para tu UI
    saldo_total: rows.reduce((acc, s) => acc + Number(s.quantity || 0), 0),
  };
}
}
