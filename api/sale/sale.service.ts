import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sale } from '../database/entities/sale.entity';
import { SaleDetail } from '../database/entities/sale-detail.entity';
import { Stock } from '../database/entities/stock.entity';
import { StockMovement } from '../database/entities/stock-movements';
import { SalePayment } from '../database/entities/sale-payments.entity';
import { Product } from '../database/entities/product.entity';
import { SaleReturn } from 'api/database/entities/sale-return.entity';
import { CashMovement } from 'api/database/entities/cash-movement.entity';
import { CashRegisterSession } from 'api/database/entities/cash-register-session.entity';
import { DataSource } from 'typeorm';

@Injectable()
export class SaleService {
  constructor(
    @InjectRepository(Sale)
    private readonly saleRepository: Repository<Sale>,

    @InjectRepository(SaleDetail)
    private readonly saleDetailRepository: Repository<SaleDetail>,

    @InjectRepository(Stock)
    private readonly stockRepository: Repository<Stock>,

    @InjectRepository(StockMovement)
    private readonly stockMovementRepository: Repository<StockMovement>,

    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,

    @InjectRepository(SaleReturn)
    private readonly saleReturnRepository: Repository<SaleReturn>,

    private readonly dataSource: DataSource,
  ) { }

  // Buscar la venta por código
  async findSaleByCode(saleCode: string, warehouseId: number): Promise<Sale> {
    const sale = await this.saleRepository.findOne({
      where: {
        sale_code: saleCode,
        warehouse: { id: warehouseId }
      },
      relations: [
        'warehouse',
        'details',
        'details.product',
        'details.productSize'
      ],
    });

    if (!sale) {
      throw new NotFoundException('Sale not found');
    }

    return sale;
  }

  // Realizar un cambio de producto
  async changeProduct(
    saleId: number,
    productId: number,
    newProductId: number,
    quantity: number,
    newProductSizeId: number,
    oldProductPrice: number,
    newProductPrice: number
  ): Promise<string> {
    const sale = await this.saleRepository.findOne({
      where: { id: saleId },
      relations: ['details', 'details.product'],
    });

    if (!sale) {
      throw new NotFoundException('Sale not found');
    }

    const saleDetail = sale.details.find((detail) => detail.product.id === productId);
    if (!saleDetail) {
      throw new BadRequestException('Product not found in sale');
    }

    // Verificamos el stock del nuevo producto con la talla seleccionada
    const stock = await this.stockRepository.findOne({
      where: { product_id: newProductId, warehouse_id: sale.warehouse_id, product_size_id: newProductSizeId }, // Usamos product_size_id
    });

    if (!stock || stock.quantity < quantity) {
      throw new BadRequestException('Insufficient stock for new product');
    }

    // Actualizar el stock del producto original (restar la cantidad)
    saleDetail.quantity -= quantity;
    saleDetail.unit_price = oldProductPrice;
    await this.saleDetailRepository.save(saleDetail);

    // Crear un nuevo detalle de venta para el producto cambiado, con la talla seleccionada
    const newSaleDetail = new SaleDetail();
    newSaleDetail.sale_id = saleId;
    newSaleDetail.product_id = newProductId;
    newSaleDetail.product_size_id = newProductSizeId;  // Guardamos el ID de la talla seleccionada
    newSaleDetail.quantity = quantity;
    newSaleDetail.unit_price = saleDetail.unit_price;
    await this.saleDetailRepository.save(newSaleDetail);

    // Actualizar el stock del nuevo producto con la talla
    stock.quantity -= quantity;
    await this.stockRepository.save(stock);

    // Registrar el movimiento de stock para el producto original
    const stockOut = new StockMovement();

    stockOut.warehouse_id = sale.warehouse_id;
    stockOut.product_id = productId;
    stockOut.product_size_id = saleDetail.product_size_id;
    stockOut.quantity = -quantity;
    stockOut.movement_type = 'salida';
    stockOut.reference = `Cambio de producto venta ${saleId}`;
    stockOut.user_id = sale.user_id;

    await this.stockMovementRepository.save(stockOut);

    // Registrar el movimiento de stock para el nuevo producto
    const stockIn = new StockMovement();

    stockIn.warehouse_id = sale.warehouse_id;
    stockIn.product_id = newProductId;
    stockIn.product_size_id = newProductSizeId;
    stockIn.quantity = quantity;
    stockIn.movement_type = 'entrada';
    stockIn.reference = `Cambio producto venta ${saleId}`;
    stockIn.user_id = sale.user_id;

    await this.stockMovementRepository.save(stockIn);

    return 'Product cambiado satisfactoriamente';
  }

  // Realizar una devolución de producto
  async returnProduct(
    saleId: number,
    productId: number,
    quantity: number,
    priceAtReturn: number,
    warehouseId: number,
    reason?: string
  ): Promise<any> {

    return this.dataSource.transaction(async (manager) => {

      // 1️⃣ Buscar la venta
      const sale = await manager.findOne(Sale, {
        where: {
          id: saleId,
          warehouse: { id: warehouseId },
        },
        relations: ['details', 'details.product', 'warehouse'],
      });

      if (!sale) {
        throw new NotFoundException('Venta no encontrada');
      }

      // 2️⃣ Buscar detalle del producto
      const saleDetail = sale.details.find(
        (detail) => detail.product.id === productId
      );

      if (!saleDetail) {
        throw new BadRequestException('Producto no encontrado en la venta');
      }

      // 3️⃣ Validar cantidad
      if (quantity > saleDetail.quantity) {
        throw new BadRequestException(
          'La cantidad a devolver es mayor que la vendida'
        );
      }

      // 4️⃣ Buscar stock
      const stock = await manager.findOne(Stock, {
        where: {
          product_id: productId,
          warehouse_id: warehouseId,
        },
      });

      if (!stock) {
        throw new NotFoundException('Stock no encontrado');
      }

      // 5️⃣ DEVOLVER AL STOCK
      stock.quantity += quantity;
      await manager.save(stock);

      // 6️⃣ ACTUALIZAR DETALLE DE VENTA
      saleDetail.quantity -= quantity;

      if (saleDetail.quantity <= 0) {
        await manager.remove(SaleDetail, saleDetail);
      } else {
        await manager.save(SaleDetail, saleDetail);
      }

      // 7️⃣ REGISTRAR MOVIMIENTO DE STOCK
      const stockMovement = manager.create(StockMovement, {
        warehouse_id: warehouseId,
        product_id: productId,
        quantity: quantity,
        movement_type: 'entrada',
        reference: `Devolución de venta ${sale.sale_code}`,
        user_id: sale.user_id,
      });

      await manager.save(stockMovement);

      // 8️⃣ CALCULAR MONTO DE DEVOLUCIÓN
      const totalRefund = Number((priceAtReturn * quantity).toFixed(2));

      // 9️⃣ REGISTRAR DEVOLUCIÓN EN TABLA SaleReturns
      const saleReturn = manager.create(SaleReturn, {
        sale_id: sale.id,
        sale_detail_id: saleDetail.id,
        product_id: productId,
        warehouse_id: warehouseId,
        user_id: sale.user_id,

        quantity: quantity,
        unit_price: priceAtReturn,
        total_refund: totalRefund,

        reason: reason || undefined,
      });

      await this.saleReturnRepository.save(saleReturn);

      // 🔟 BUSCAR CAJA ABIERTA
      const session = await manager.findOne(CashRegisterSession, {
        where: {
          warehouse_id: warehouseId,
          status: 'OPEN',
        },
        order: { opened_at: 'DESC' },
      });

      if (!session) {
        throw new BadRequestException('No hay caja abierta');
      }

      // 1️⃣1️⃣ REGISTRAR DEVOLUCIÓN EN CAJA
      const cashMovement = manager.create(CashMovement, {
        session_id: session.id,
        warehouse_id: warehouseId,
        user_id: sale.user_id,

        type: 'RETURN',
        payment_method: sale.payment_method || 'efectivo',

        amount: -totalRefund,

        reference_sale_id: sale.id,
        description: `Devolución venta ${sale.sale_code}`,
      });

      await manager.save(cashMovement);

      // 1️⃣2️⃣ VERIFICAR SI QUEDAN PRODUCTOS EN LA VENTA
      const remainingDetails = await manager.count(SaleDetail, {
        where: { sale_id: sale.id },
      });

      if (remainingDetails === 0) {
        sale.status = 'returned';
      } else {
        sale.status = 'partial_return';
      }

      await manager.save(sale);

      return {
        message: 'Producto devuelto correctamente',
        refundAmount: totalRefund,
      };
    });
  }
}