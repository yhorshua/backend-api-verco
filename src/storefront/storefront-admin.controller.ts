import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  CreateProductImageDto,
  RegisterProductImagesDto,
  UpdateEcommerceProductDto,
} from './dto/catalog-admin.dto';
import { StorefrontService } from './storefront.service';
import { UpdateEcommerceOrderStatusDto } from './dto/update-ecommerce-order-status.dto';
import {
  SyncCloudinaryFolderDto,
  SyncCloudinaryImagesDto,
} from './dto/sync-cloudinary-images.dto';
import { CloudinarySyncService } from './cloudinary-sync.service';
import { CatalogAdminQueryDto } from './dto/catalog-admin-query.dto';
import { CreateSoominProductDto } from './dto/create-soomin-product.dto';
import { RespondEcommerceClaimDto } from './dto/respond-ecommerce-claim.dto';

@Controller('storefront-admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Administrador', 'Jefe Ventas')
export class StorefrontAdminController {
  constructor(
    private readonly storefrontService: StorefrontService,
    private readonly cloudinarySyncService: CloudinarySyncService,
  ) {}

  @Get('soomin/overview')
  @Roles('Administrador')
  getSoominOverview() {
    return this.storefrontService.getAdminOverview('soomin-store');
  }

  @Get('soomin/settings')
  @Roles('Administrador')
  getSoominSettings() {
    return this.storefrontService.getAdminSettings('soomin-store');
  }

  @Post('soomin/products')
  @Roles('Administrador')
  createSoominProduct(@Body() body: CreateSoominProductDto) {
    return this.storefrontService.createStorefrontProduct('soomin-store', body);
  }

  @Get('soomin/orders')
  @Roles('Administrador')
  listSoominOrders(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.storefrontService.listStorefrontOrders(
      'soomin-store',
      Number(page) || 1,
      Number(limit) || 25,
    );
  }

  @Patch('soomin/orders/:orderId/status')
  @Roles('Administrador')
  updateSoominOrderStatus(
    @Param('orderId') orderId: string,
    @Body() body: UpdateEcommerceOrderStatusDto,
    @Req() request: { user: { userId: number } },
  ) {
    return this.storefrontService.updateOrderStatus(
      Number(orderId),
      body,
      'soomin-store',
      request.user.userId,
    );
  }

  @Get('soomin/claims')
  @Roles('Administrador')
  listSoominClaims(@Query('page') page?:string,@Query('limit') limit?:string){
    return this.storefrontService.listClaims('soomin-store',Number(page)||1,Number(limit)||25);
  }

  @Patch('soomin/claims/:id/respond')
  @Roles('Administrador')
  respondSoominClaim(@Param('id') id:string,@Body() body:RespondEcommerceClaimDto){
    return this.storefrontService.respondClaim('soomin-store',Number(id),body);
  }

  @Post('images/cloudinary/sync/:articleCode')
  @Roles('Administrador')
  syncCloudinaryImages(
    @Param('articleCode') articleCode: string,
    @Body() body: SyncCloudinaryImagesDto,
  ) {
    return this.cloudinarySyncService.syncProductImages(articleCode, body);
  }

  @Post('images/cloudinary/sync-folder')
  @Roles('Administrador')
  syncCloudinaryFolder(@Body() body: SyncCloudinaryFolderDto) {
    return this.cloudinarySyncService.syncAssetFolder(body);
  }

  @Get('products/search')
  @Roles('Administrador')
  searchProducts(@Query() query: CatalogAdminQueryDto) {
    return this.storefrontService.searchCatalogAdminProducts(query);
  }

  @Get('products/:productId')
  @Roles('Administrador')
  getProduct(
    @Param('productId') productId: string,
    @Query('warehouseId') warehouseId: string,
  ) {
    return this.storefrontService.getCatalogAdminProduct(
      Number(productId),
      Number(warehouseId),
    );
  }

  @Patch('products/:productId')
  @Roles('Administrador')
  updateProduct(
    @Param('productId') productId: string,
    @Body() body: UpdateEcommerceProductDto,
  ) {
    return this.storefrontService.updateCatalogProduct(Number(productId), body);
  }

  @Post('products/:productId/images')
  @Roles('Administrador')
  addImage(
    @Param('productId') productId: string,
    @Body() body: CreateProductImageDto,
  ) {
    return this.storefrontService.addProductImage(Number(productId), body);
  }

  @Post('products/:productId/images/bulk')
  @Roles('Administrador')
  registerImages(
    @Param('productId') productId: string,
    @Body() body: RegisterProductImagesDto,
  ) {
    return this.storefrontService.registerProductImages(
      { productId: Number(productId) },
      body,
    );
  }

  @Post('products/by-code/:articleCode/images/bulk')
  @Roles('Administrador')
  registerImagesByCode(
    @Param('articleCode') articleCode: string,
    @Body() body: RegisterProductImagesDto,
  ) {
    return this.storefrontService.registerProductImages({ articleCode }, body);
  }

  @Delete('products/:productId/images/:imageId')
  @Roles('Administrador')
  removeImage(
    @Param('productId') productId: string,
    @Param('imageId') imageId: string,
  ) {
    return this.storefrontService.removeProductImage(
      Number(productId),
      Number(imageId),
    );
  }

  @Get('orders')
  listOrders(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.storefrontService.listOrders(
      Number(page) || 1,
      Number(limit) || 25,
    );
  }

  @Patch('orders/:orderId/status')
  updateOrderStatus(
    @Param('orderId') orderId: string,
    @Body() body: UpdateEcommerceOrderStatusDto,
    @Req() request: { user: { userId: number } },
  ) {
    return this.storefrontService.updateOrderStatus(
      Number(orderId),
      body,
      undefined,
      request.user.userId,
    );
  }
}
