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
    warehouseId: number,
    productId: number,
    oldProductSizeId: number,
    newProductId: number,
    quantity: number,
    newProductSizeId: number,
    oldProductPrice: number,
    newProductPrice: number
  ): Promise<any> {

    return this.dataSource.transaction(async (manager) => {

      /** 1️⃣ BUSCAR LA VENTA */
      const sale = await manager.findOne(Sale, {
        where: {
          id: saleId,
          warehouse: { id: warehouseId }
        },
        relations: ['details', 'details.product', 'details.productSize', 'warehouse']
      });

      if (!sale) {
        throw new NotFoundException('Sale not found');
      }

      /** 2️⃣ BUSCAR DETALLE DE LA VENTA */
      const saleDetail = await manager.findOne(SaleDetail, {
        where: {
          sale_id: saleId,
          product_id: productId,
          product_size_id: oldProductSizeId
        }
      });
      if (!saleDetail) {
        throw new BadRequestException('Product not found in sale');
      }

      /** 3️⃣ VALIDAR CANTIDAD */
      if (quantity > saleDetail.quantity) {
        throw new BadRequestException(
          'Quantity to exchange exceeds quantity sold'
        );
      }

      /** 4️⃣ BUSCAR STOCK DEL NUEVO PRODUCTO */
      const newStock = await manager.findOne(Stock, {
        where: {
          product_id: newProductId,
          warehouse_id: warehouseId,
          product_size_id: newProductSizeId
        }
      });

      if (!newStock || newStock.quantity < quantity) {
        throw new BadRequestException('Insufficient stock for new product');
      }
      /** 5️⃣ DEVOLVER STOCK DEL PRODUCTO ORIGINAL */
      const oldStock = await manager.findOne(Stock, {
        where: {
          product_id: productId,
          warehouse_id: warehouseId,
          product_size_id: oldProductSizeId
        }
      });

      if (!oldStock) {
        throw new NotFoundException('Original stock not found');
      }

      oldStock.quantity += quantity;
      await manager.save(oldStock);

      /** 6️⃣ ACTUALIZAR DETALLE ORIGINAL */
      saleDetail.quantity -= quantity;

      if (saleDetail.quantity <= 0) {
        await manager.remove(SaleDetail, saleDetail);
      } else {
        await manager.save(SaleDetail, saleDetail);
      }

      /** 7️⃣ CREAR NUEVO DETALLE */
      const newSaleDetail = manager.create(SaleDetail, {
        sale_id: saleId,
        product_id: newProductId,
        product_size_id: newProductSizeId,
        quantity: quantity,
        unit_price: newProductPrice
      });

      await manager.save(newSaleDetail);

      /** 8️⃣ DESCONTAR STOCK NUEVO PRODUCTO */
      newStock.quantity -= quantity;
      await manager.save(newStock);

      /** 9️⃣ MOVIMIENTO STOCK DEVOLUCIÓN */
      const stockIn = manager.create(StockMovement, {
        warehouse_id: warehouseId,
        product_id: productId,
        product_size_id: oldProductSizeId,
        quantity: quantity,
        movement_type: 'entrada',
        reference: `Cambio producto venta ${sale.sale_code}`,
        user_id: sale.user_id
      });

      await manager.save(stockIn);

      /** 🔟 MOVIMIENTO STOCK SALIDA NUEVO PRODUCTO */
      const stockOut = manager.create(StockMovement, {
        warehouse_id: warehouseId,
        product_id: newProductId,
        product_size_id: newProductSizeId,
        quantity: -quantity,
        movement_type: 'salida',
        reference: `Cambio producto venta ${sale.sale_code}`,
        user_id: sale.user_id
      });

      await manager.save(stockOut);

      /** 1️⃣1️⃣ DIFERENCIA DE PRECIO */
      const difference =
        (newProductPrice - oldProductPrice) * quantity;

      let message = 'Producto cambiado correctamente';

      if (difference !== 0) {

        const session = await manager.findOne(CashRegisterSession, {
          where: {
            warehouse_id: warehouseId,
            status: 'OPEN'
          },
          order: { opened_at: 'DESC' }
        });

        if (!session) {
          throw new BadRequestException('No open cash register');
        }

        const cashMovement = manager.create(CashMovement, {
          session_id: session.id,
          warehouse_id: warehouseId,
          user_id: sale.user_id,
          type: 'EXCHANGE',
          payment_method: sale.payment_method || 'cash',
          amount: difference,
          reference_sale_id: sale.id,
          description: `Diferencia cambio venta ${sale.sale_code}`
        });

        await manager.save(cashMovement);

        message =
          difference > 0
            ? `Cliente debe pagar ${difference}`
            : `Cliente recibe ${Math.abs(difference)}`;
      }

      return {
        message,
        priceDifference: difference
      };
    });
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