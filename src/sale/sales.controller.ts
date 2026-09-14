import { Controller, Get, Post, Body, Param, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { SaleService } from './sale.service';
import { ChangeProductDto, ReturnProductDto } from './dto/sale.dto';  // Importa los DTOs
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('sales')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Administrador', 'Tienda')
export class SaleController {
  constructor(private readonly saleService: SaleService) { }

  private assertWarehouseAccess(warehouseId: number, user: any) {
    if (user?.role !== 'Administrador' && Number(user?.warehouseId) !== Number(warehouseId)) {
      throw new ForbiddenException('No tienes permisos para consultar este almacén');
    }
  }

  // Buscar venta por código
  @Get(':saleCode/:warehouseId')
  async getSaleByCode(
    @Param('saleCode') saleCode: string,
    @Param('warehouseId') warehouseId: number,
    @Req() req: any,
  ) {
    this.assertWarehouseAccess(warehouseId, req.user);
    return this.saleService.findSaleByCode(saleCode, warehouseId);
  }

  // Cambio de producto
  @Post('change-product')
  async changeProduct(@Body() dto: ChangeProductDto, @Req() req: any) {

    this.assertWarehouseAccess(dto.warehouse_id, req.user);

    return this.saleService.changeProduct(
      dto.sale_id,
      dto.warehouse_id,
      dto.product_id,
      dto.old_product_size_id,
      dto.new_product_id,
      dto.quantity,
      dto.new_product_size_id,
      dto.old_product_price,
      dto.new_product_price,

    );

  }

  // Devolución de producto
  @Post('return-product')
  async returnProduct(@Body() dto: ReturnProductDto, @Req() req: any) {

    this.assertWarehouseAccess(dto.warehouse_id, req.user);

    return this.saleService.returnProduct(
      dto.sale_id,
      dto.product_id,
      dto.quantity,
      dto.price_at_return,
      dto.warehouse_id,
      dto.reason
    );

  }
}
