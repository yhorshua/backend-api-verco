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
  async changeProduct(
    @Body() changeProductDto: ChangeProductDto,  // Usamos el DTO para recibir los datos
  ) {
    const { sale_id, product_id, new_product_id, quantity } = changeProductDto;
    return this.saleService.changeProduct(sale_id, product_id, new_product_id, quantity);
  }

  // Devolución de producto
  @Post('return-product')
  async returnProduct(
    @Body() returnProductDto: ReturnProductDto,  // Usamos el DTO para recibir los datos
  ) {
    const { sale_id, product_id, quantity } = returnProductDto;
    return this.saleService.returnProduct(sale_id, product_id, quantity);
  }
}
