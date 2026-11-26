import { Body, Controller, Get, Headers, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CreateEcommerceOrderDto } from './dto/create-ecommerce-order.dto';
import { StorefrontService } from './storefront.service';
import { CreateEcommerceClaimDto } from './dto/create-ecommerce-claim.dto';
import { StorefrontWriteRateLimitGuard } from './storefront-write-rate-limit.guard';
import {StorefrontCustomerAuthService} from './storefront-customer-auth.service';
import {GoogleCustomerLoginDto,UpdateCustomerProfileDto} from './dto/customer-auth.dto';

@Controller('storefront')
export class StorefrontController {
  constructor(private readonly storefrontService: StorefrontService,private readonly customerAuth:StorefrontCustomerAuthService) {}

  @Post(':storeSlug/customer-auth/google')
  @UseGuards(StorefrontWriteRateLimitGuard)
  googleLogin(@Param('storeSlug') slug:string,@Body() body:GoogleCustomerLoginDto){return this.customerAuth.loginGoogle(slug,body)}
  @Get(':storeSlug/customer/me')
  customerMe(@Param('storeSlug') slug:string,@Headers('authorization') authorization?:string){return this.customerAuth.me(slug,authorization)}
  @Patch(':storeSlug/customer/me')
  customerUpdate(@Param('storeSlug') slug:string,@Headers('authorization') authorization:string|undefined,@Body() body:UpdateCustomerProfileDto){return this.customerAuth.update(slug,authorization,body)}
  @Get(':storeSlug/customer/orders')
  customerOrders(@Param('storeSlug') slug:string,@Headers('authorization') authorization?:string){return this.customerAuth.orders(slug,authorization)}

  @Get(':storeSlug/catalog')
  getCatalog(@Param('storeSlug') storeSlug: string) {
    return this.storefrontService.getCatalog(storeSlug);
  }

  @Post(':storeSlug/orders')
  @UseGuards(StorefrontWriteRateLimitGuard)
  createOrder(
    @Param('storeSlug') storeSlug: string,
    @Body() body: CreateEcommerceOrderDto,
    @Headers('authorization') authorization?:string,
  ) {
    return this.customerAuth.optionalCustomerId(storeSlug,authorization).then(customerId=>this.storefrontService.createOrder(storeSlug, body,customerId));
  }

  @Post(':storeSlug/claims')
  @UseGuards(StorefrontWriteRateLimitGuard)
  createClaim(@Param('storeSlug') storeSlug:string,@Body() body:CreateEcommerceClaimDto){
    return this.storefrontService.createClaim(storeSlug,body);
  }
}
