import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { SaleService } from './sale.service';
import { ChangeProductDto, ReturnProductDto } from './dto/sale.dto';  // Importa los DTOs

@Controller('sales')
export class SaleController {
  constructor(private readonly saleService: SaleService) {}

  // Buscar venta por código
  @Get(':saleCode')
  async getSaleByCode(@Param('saleCode') saleCode: string) {
    return this.saleService.findSaleByCode(saleCode);
  }

  // Cambio de producto
  @Post('change-product')
  async changeProduct(@Body() dto: ChangeProductDto) {

    return this.saleService.changeProduct(
      dto.sale_id,
      dto.product_id,
      dto.new_product_id,
      dto.quantity,
      dto.new_product_size_id,
      dto.old_product_price,
      dto.new_product_price
    );

  }

  // Devolución de producto
  @Post('return-product')
  async returnProduct(@Body() dto: ReturnProductDto) {

    return this.saleService.returnProduct(
      dto.sale_id,
      dto.product_id,
      dto.quantity,
      dto.price_at_return,
      dto.reason
    );

  }
}
