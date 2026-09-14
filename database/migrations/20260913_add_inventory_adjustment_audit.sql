-- Ajustes de inventario auditables, idempotentes y con bloqueo optimista.
-- No elimina ni transforma existencias actuales.

SET @schema_name = DATABASE();

SET @sql = IF(
  EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'Stock' AND COLUMN_NAME = 'version'),
  'SELECT 1',
  'ALTER TABLE `Stock` ADD COLUMN `version` INT UNSIGNED NOT NULL DEFAULT 1 AFTER `unit_of_measure`'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'Stock' AND COLUMN_NAME = 'updated_at_utc'),
  'SELECT 1',
  'ALTER TABLE `Stock` ADD COLUMN `updated_at_utc` DATETIME(3) NULL AFTER `version`'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `InventoryAdjustmentOperations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `operation_code` VARCHAR(32) NOT NULL,
  `idempotency_key` VARCHAR(36) NOT NULL,
  `request_hash` CHAR(64) NOT NULL,
  `warehouse_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `user_name_snapshot` VARCHAR(100) NOT NULL,
  `role_snapshot` VARCHAR(50) NOT NULL,
  `reason_code` VARCHAR(40) NOT NULL,
  `observation` VARCHAR(500) NULL,
  `correlation_id` VARCHAR(64) NOT NULL,
  `request_ip` VARCHAR(45) NULL,
  `status` VARCHAR(20) NOT NULL,
  `item_count` INT NOT NULL,
  `occurred_at_utc` DATETIME(3) NOT NULL,
  `occurred_at_lima` VARCHAR(35) NOT NULL,
  `business_date` DATE NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_inventory_adjustment_code` (`operation_code`),
  UNIQUE KEY `uq_inventory_adjustment_idempotency` (`idempotency_key`),
  KEY `idx_inventory_adjustment_warehouse_date` (`warehouse_id`, `business_date`),
  KEY `idx_inventory_adjustment_user_date` (`user_id`, `business_date`),
  CONSTRAINT `fk_inventory_adjustment_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `Warehouses` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_inventory_adjustment_user` FOREIGN KEY (`user_id`) REFERENCES `Users` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `chk_inventory_adjustment_status` CHECK (`status` IN ('APPLIED')),
  CONSTRAINT `chk_inventory_adjustment_items` CHECK (`item_count` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `InventoryAdjustmentDetails` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `operation_id` BIGINT UNSIGNED NOT NULL,
  `stock_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `product_size_id` INT NULL,
  `sku_snapshot` VARCHAR(50) NOT NULL,
  `description_snapshot` VARCHAR(150) NOT NULL,
  `size_snapshot` VARCHAR(20) NULL,
  `previous_quantity` INT NOT NULL,
  `new_quantity` INT NOT NULL,
  `difference_quantity` INT NOT NULL,
  `stock_version_before` INT UNSIGNED NOT NULL,
  `stock_version_after` INT UNSIGNED NOT NULL,
  `result` VARCHAR(20) NOT NULL,
  `error_message` VARCHAR(255) NULL,
  `occurred_at_utc` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_inventory_adjustment_detail_stock` (`operation_id`, `stock_id`),
  KEY `idx_inventory_adjustment_detail_product` (`product_id`, `product_size_id`),
  CONSTRAINT `fk_inventory_adjustment_detail_operation` FOREIGN KEY (`operation_id`) REFERENCES `InventoryAdjustmentOperations` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_inventory_adjustment_detail_stock` FOREIGN KEY (`stock_id`) REFERENCES `Stock` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `chk_inventory_adjustment_detail_result` CHECK (`result` IN ('APPLIED')),
  CONSTRAINT `chk_inventory_adjustment_nonnegative` CHECK (`previous_quantity` >= 0 AND `new_quantity` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
