DROP TABLE IF EXISTS `EcommerceOrderDetails`;
DROP TABLE IF EXISTS `EcommerceOrders`;
DROP TABLE IF EXISTS `Storefronts`;

ALTER TABLE `Products`
  DROP INDEX `idx_products_ecommerce_catalog`,
  DROP INDEX `idx_products_ecommerce_group`,
  DROP COLUMN `color_code`,
  DROP COLUMN `ecommerce_group_code`;
