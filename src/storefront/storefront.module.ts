import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EcommerceOrderDetail } from '../database/entities/ecommerce-order-detail.entity';
import { EcommerceOrder } from '../database/entities/ecommerce-order.entity';
import { ProductImage } from '../database/entities/productImage.entity';
import { Product } from '../database/entities/product.entity';
import { Storefront } from '../database/entities/storefront.entity';
import { StorefrontCacheService } from './storefront-cache.service';
import { StorefrontController } from './storefront.controller';
import { StorefrontService } from './storefront.service';
import { StorefrontAdminController } from './storefront-admin.controller';
import { CloudinarySyncService } from './cloudinary-sync.service';
import { EcommerceClaim } from '../database/entities/ecommerce-claim.entity';
import { StorefrontWriteRateLimitGuard } from './storefront-write-rate-limit.guard';
import { StorefrontEmailService } from './storefront-email.service';
import { EcommerceCustomer } from '../database/entities/ecommerce-customer.entity';
import { StorefrontCustomerAuthService } from './storefront-customer-auth.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Storefront,
      EcommerceOrder,
      EcommerceOrderDetail,
      Product,
      ProductImage,
      EcommerceClaim,
      EcommerceCustomer,
    ]),
  ],
  controllers: [StorefrontController, StorefrontAdminController],
  providers: [StorefrontService, StorefrontCacheService, CloudinarySyncService, StorefrontWriteRateLimitGuard, StorefrontEmailService, StorefrontCustomerAuthService],
  exports: [StorefrontService],
})
export class StorefrontModule {}
