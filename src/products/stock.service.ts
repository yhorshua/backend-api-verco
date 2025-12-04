import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Stock } from './entities/stock.entity';
import { StockMovement } from './entities/stockMovements.entity';
import { Sale } from './entities/sale.entity';
import { SaleDetail } from './entities/sale-detail.entity';
import { CreateMovementDto } from './dto/create-movement.dto';
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
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Consultar stock por tienda (warehouse)
   */
  async getStockByWarehouse(warehouseId: number): Promise<Stock[]> {
    return await this.stockRepo.find({
      where: { warehouse_id: warehouseId },
      relations: ['product', 'productSize'],
    });
  }

  /**
   * Registrar ingreso de mercadería
   */
  async registerIncoming(dto: CreateMovementDto): Promise<StockMovement> {
    const movement = this.movementRepo.create({
      ...dto,
      movement_type: 'entrada',
      quantity: Math.abs(dto.quantity),
    });
    await this.movementRepo.save(movement);

    await this.stockRepo.increment(
      {
        warehouse_id: dto.warehouse_id,
        product_id: dto.product_id,
        product_size_id: dto.product_size_id,
      },
      'quantity',
      dto.quantity,
    );

    return movement;
  }

  /**
   * Registrar venta (crea Sale, SaleDetail y StockMovement)
   */
  async registerSale(dto: CreateSaleDto): Promise<{ sale: Sale; movement: StockMovement }> {
    return await this.dataSource.transaction(async manager => {
      // 1. Validar stock
      const stock = await manager.findOne(Stock, {
        where: {
          warehouse_id: dto.warehouse_id,
          product_id: dto.product_id,
          product_size_id: dto.product_size_id,
        },
        relations: ['product'],
      });
      if (!stock || stock.quantity < dto.quantity) {
        throw new NotFoundException('Stock insuficiente para la venta');
      }

      // 2. Crear cabecera de venta
      const sale = manager.create(Sale, {
        warehouse_id: dto.warehouse_id,
        user_id: dto.user_id,
        customer_id: dto.customer_id,
        total_amount: dto.quantity * stock.product.unit_price,
        payment_method: dto.payment_method,
      });
      await manager.save(Sale, sale);

      // 3. Crear detalle de venta
      const saleDetail = manager.create(SaleDetail, {
        sale_id: sale.id,
        product_id: dto.product_id,
        product_size_id: dto.product_size_id,
        quantity: dto.quantity,
        unit_price: stock.product.unit_price,
      });
      await manager.save(SaleDetail, saleDetail);

      // 4. Registrar movimiento de stock
      const movement = manager.create(StockMovement, {
        warehouse_id: dto.warehouse_id,
        product_id: dto.product_id,
        product_size_id: dto.product_size_id,
        quantity: -Math.abs(dto.quantity),
        unit_of_measure: dto.unit_of_measure, // o lo que venga en DTO
        movement_type: 'salida',
        reference: `Venta #${sale.id}`,
        user_id: dto.user_id,
      });
      await manager.save(StockMovement, movement);

      // 5. Actualizar stock
      await manager.decrement(
        Stock,
        {
          warehouse_id: dto.warehouse_id,
          product_id: dto.product_id,
          product_size_id: dto.product_size_id,
        },
        'quantity',
        dto.quantity,
      );

      return { sale, movement };
    });
  }

  /**
   * Registrar devolución
   */
  async registerReturn(dto: CreateMovementDto): Promise<StockMovement> {
    const movement = this.movementRepo.create({
      ...dto,
      movement_type: 'entrada',
      quantity: Math.abs(dto.quantity),
    });
    await this.movementRepo.save(movement);

    await this.stockRepo.increment(
      {
        warehouse_id: dto.warehouse_id,
        product_id: dto.product_id,
        product_size_id: dto.product_size_id,
      },
      'quantity',
      dto.quantity,
    );

    return movement;
  }

  /**
   * Reporte de movimientos por día
   */
  async getMovementsByDay(date: string): Promise<StockMovement[]> {
    return await this.movementRepo
      .createQueryBuilder('movement')
      .where('CAST(movement.created_at AS DATE) = :date', { date })
      .getMany();
  }

  /**
   * Reporte de movimientos por mes
   */
  async getMovementsByMonth(year: number, month: number): Promise<StockMovement[]> {
    return await this.movementRepo
      .createQueryBuilder('movement')
      .where('YEAR(movement.created_at) = :year', { year })
      .andWhere('MONTH(movement.created_at) = :month', { month })
      .getMany();
  }
}