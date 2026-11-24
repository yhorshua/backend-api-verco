import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CreateEcommerceOrderDto } from './dto/create-ecommerce-order.dto';
import { StorefrontService } from './storefront.service';
import { CreateEcommerceClaimDto } from './dto/create-ecommerce-claim.dto';
import { StorefrontWriteRateLimitGuard } from './storefront-write-rate-limit.guard';

@Controller('storefront')
export class StorefrontController {
  constructor(private readonly storefrontService: StorefrontService) {}

  @Get(':storeSlug/catalog')
  getCatalog(@Param('storeSlug') storeSlug: string) {
    return this.storefrontService.getCatalog(storeSlug);
  }

  @Post(':storeSlug/orders')
  @UseGuards(StorefrontWriteRateLimitGuard)
  createOrder(
    @Param('storeSlug') storeSlug: string,
    @Body() body: CreateEcommerceOrderDto,
  ) {
    return this.storefrontService.createOrder(storeSlug, body);
  }

  @Post(':storeSlug/claims')
  @UseGuards(StorefrontWriteRateLimitGuard)
  createClaim(@Param('storeSlug') storeSlug:string,@Body() body:CreateEcommerceClaimDto){
    return this.storefrontService.createClaim(storeSlug,body);
  }
}
