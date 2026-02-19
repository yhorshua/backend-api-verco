import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sale } from '../database/entities/sale.entity';
import { SaleDetail } from '../database/entities/sale-detail.entity';
import { Stock } from '../database/entities/stock.entity';
import { StockMovement } from '../database/entities/stock-movements';
import { SalePayment } from '../database/entities/sale-payments.entity';
import { Product } from '../database/entities/product.entity';

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
  ) {}

  // Buscar la venta por código
  async findSaleByCode(saleCode: string): Promise<Sale> {
    const sale = await this.saleRepository.findOne({
      where: { sale_code: saleCode },
      relations: ['details', 'details.product', 'details.productSize'],
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
  ): Promise<string> {
    // Buscar la venta
    const sale = await this.saleRepository.findOne({
      where: { id: saleId },
      relations: ['details', 'details.product'],
    });

    if (!sale) {
      throw new NotFoundException('Sale not found');
    }

    // Verifica si el producto original está en la venta
    const saleDetail = sale.details.find((detail) => detail.product.id === productId);
    if (!saleDetail) {
      throw new BadRequestException('Product not found in sale');
    }

    // Verifica el stock disponible para el nuevo producto
    const stock = await this.stockRepository.findOne({
      where: { product_id: newProductId, warehouse_id: sale.warehouse_id },
    });
    if (!stock || stock.quantity < quantity) {
      throw new BadRequestException('Insufficient stock for new product');
    }

    // Actualizar el stock del producto original (restar la cantidad)
    saleDetail.quantity -= quantity;
    await this.saleDetailRepository.save(saleDetail);

    // Crear un nuevo detalle de venta para el producto cambiado
    const newSaleDetail = new SaleDetail();
    newSaleDetail.sale_id = saleId;
    newSaleDetail.product_id = newProductId;
    newSaleDetail.quantity = quantity;
    newSaleDetail.unit_price = saleDetail.unit_price;
    await this.saleDetailRepository.save(newSaleDetail);

    // Actualizar el stock del nuevo producto
    stock.quantity -= quantity;
    await this.stockRepository.save(stock);

    // Registrar el movimiento de stock (salida del producto original, entrada del nuevo)
    const stockMovement = new StockMovement();
    stockMovement.warehouse_id = sale.warehouse_id;
    stockMovement.product_id = productId;
    stockMovement.product_size_id = saleDetail.product_size_id;
    stockMovement.quantity = -quantity; // Salida
    stockMovement.movement_type = 'salida';
    stockMovement.reference = `Cambio de producto de venta ${saleId}`;
    stockMovement.user_id = sale.user_id;
    await this.stockMovementRepository.save(stockMovement);

    const newStockMovement = new StockMovement();
    newStockMovement.warehouse_id = sale.warehouse_id;
    newStockMovement.product_id = newProductId;
    newStockMovement.quantity = quantity; // Entrada
    newStockMovement.movement_type = 'entrada';
    newStockMovement.reference = `Cambio de producto a venta ${saleId}`;
    newStockMovement.user_id = sale.user_id;
    await this.stockMovementRepository.save(newStockMovement);

    return 'Product successfully changed';
  }

  // Realizar una devolución de producto
  async returnProduct(
    saleId: number,
    productId: number,
    quantity: number,
  ): Promise<string> {
    // Buscar la venta
    const sale = await this.saleRepository.findOne({
      where: { id: saleId },
      relations: ['details'],
    });

    if (!sale) {
      throw new NotFoundException('Sale not found');
    }

    // Verifica si el producto está en la venta
    const saleDetail = sale.details.find((detail) => detail.product.id === productId);
    if (!saleDetail) {
      throw new BadRequestException('Product not found in sale');
    }

    // Actualizar el stock (devuelve el producto)
    const stock = await this.stockRepository.findOne({
      where: { product_id: productId, warehouse_id: sale.warehouse_id },
    });

    if (!stock) {
      throw new NotFoundException('Stock not found');
    }

    stock.quantity += quantity;
    await this.stockRepository.save(stock);

    // Actualizar la venta (reduce la cantidad del producto vendido)
    saleDetail.quantity -= quantity;
    await this.saleDetailRepository.save(saleDetail);

    // Registrar el movimiento de stock (entrada del producto devuelto)
    const stockMovement = new StockMovement();
    stockMovement.warehouse_id = sale.warehouse_id;
    stockMovement.product_id = productId;
    stockMovement.quantity = quantity; // Entrada
    stockMovement.movement_type = 'entrada';
    stockMovement.reference = `Devolución de producto de venta ${saleId}`;
    stockMovement.user_id = sale.user_id;
    await this.stockMovementRepository.save(stockMovement);

    return 'Product successfully returned';
  }
}
