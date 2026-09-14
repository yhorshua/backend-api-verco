-- Cotizaciones persistentes, correlativo anual, auditoría y trazabilidad con pedidos.
CREATE TABLE IF NOT EXISTS `QuotationSequences` (
  `year` SMALLINT UNSIGNED NOT NULL,
  `last_number` INT UNSIGNED NOT NULL DEFAULT 0,
  `updated_at_utc` DATETIME(3) NOT NULL,
  PRIMARY KEY (`year`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `OrderSequences` (
  `sequence_name` VARCHAR(30) NOT NULL,
  `last_number` INT UNSIGNED NOT NULL DEFAULT 0,
  `updated_at_utc` DATETIME(3) NOT NULL,
  PRIMARY KEY (`sequence_name`)
) ENGINE=InnoDB;
INSERT INTO `OrderSequences` (`sequence_name`,`last_number`,`updated_at_utc`)
SELECT 'WHOLESALE', COALESCE(MAX(`proforma_number`),0), UTC_TIMESTAMP(3) FROM `Orders`
ON DUPLICATE KEY UPDATE `last_number` = GREATEST(`last_number`, VALUES(`last_number`));

CREATE TABLE IF NOT EXISTS `Quotations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `quote_number` VARCHAR(20) NOT NULL,
  `idempotency_key` CHAR(36) NOT NULL,
  `quote_year` SMALLINT UNSIGNED NOT NULL,
  `sequence_number` INT UNSIGNED NOT NULL,
  `client_id` INT NOT NULL,
  `seller_id` INT NOT NULL,
  `warehouse_id` INT NOT NULL,
  `currency` CHAR(3) NOT NULL DEFAULT 'PEN',
  `issued_at_utc` DATETIME(3) NOT NULL,
  `issued_at_lima` VARCHAR(35) NOT NULL,
  `business_date` DATE NOT NULL,
  `expires_on` DATE NULL,
  `subtotal` DECIMAL(12,2) NOT NULL,
  `discount_total` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `tax_total` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total` DECIMAL(12,2) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'ISSUED',
  `observations` VARCHAR(500) NULL,
  `created_by` INT NOT NULL,
  `updated_by` INT NULL,
  `updated_at_utc` DATETIME(3) NULL,
  `cancelled_by` INT NULL,
  `cancelled_at_utc` DATETIME(3) NULL,
  `cancellation_reason` VARCHAR(255) NULL,
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_quotations_number` (`quote_number`),
  UNIQUE KEY `uq_quotations_idempotency` (`idempotency_key`),
  UNIQUE KEY `uq_quotations_year_sequence` (`quote_year`,`sequence_number`),
  KEY `idx_quotations_client_seller_status` (`client_id`,`seller_id`,`status`),
  KEY `idx_quotations_business_date` (`business_date`),
  KEY `idx_quotations_expiry_status` (`expires_on`,`status`),
  CONSTRAINT `fk_quotations_client` FOREIGN KEY (`client_id`) REFERENCES `Clients` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_quotations_seller` FOREIGN KEY (`seller_id`) REFERENCES `Users` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_quotations_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `Warehouses` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_quotations_creator` FOREIGN KEY (`created_by`) REFERENCES `Users` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `chk_quotations_amounts` CHECK (`subtotal` >= 0 AND `discount_total` >= 0 AND `tax_total` >= 0 AND `total` >= 0),
  CONSTRAINT `chk_quotations_status` CHECK (`status` IN ('DRAFT','ISSUED','PARTIALLY_USED','USED','EXPIRED','CANCELLED'))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `QuotationDetails` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `quotation_id` BIGINT UNSIGNED NOT NULL,
  `product_id` INT NOT NULL,
  `product_size_id` INT NULL,
  `sku_snapshot` VARCHAR(50) NOT NULL,
  `description_snapshot` VARCHAR(150) NOT NULL,
  `size_snapshot` VARCHAR(20) NULL,
  `quantity` INT UNSIGNED NOT NULL,
  `used_quantity` INT UNSIGNED NOT NULL DEFAULT 0,
  `unit_price` DECIMAL(12,2) NOT NULL,
  `discount_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `tax_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `line_total` DECIMAL(12,2) NOT NULL,
  `created_at_utc` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_quotation_product_size` (`quotation_id`,`product_id`,`product_size_id`),
  KEY `idx_quotation_details_product` (`product_id`,`product_size_id`),
  CONSTRAINT `fk_quotation_details_header` FOREIGN KEY (`quotation_id`) REFERENCES `Quotations` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_quotation_details_product` FOREIGN KEY (`product_id`) REFERENCES `Products` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_quotation_details_size` FOREIGN KEY (`product_size_id`) REFERENCES `ProductSize` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `chk_quotation_details_quantity` CHECK (`quantity` > 0 AND `used_quantity` <= `quantity`),
  CONSTRAINT `chk_quotation_details_amounts` CHECK (`unit_price` >= 0 AND `discount_amount` >= 0 AND `tax_amount` >= 0 AND `line_total` >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `QuotationHistory` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `quotation_id` BIGINT UNSIGNED NOT NULL,
  `action` VARCHAR(30) NOT NULL,
  `previous_status` VARCHAR(20) NULL,
  `new_status` VARCHAR(20) NOT NULL,
  `user_id` INT NOT NULL,
  `notes` VARCHAR(255) NULL,
  `occurred_at_utc` DATETIME(3) NOT NULL,
  `occurred_at_lima` VARCHAR(35) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_quotation_history_quote_date` (`quotation_id`,`occurred_at_utc`),
  CONSTRAINT `fk_quotation_history_header` FOREIGN KEY (`quotation_id`) REFERENCES `Quotations` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_quotation_history_user` FOREIGN KEY (`user_id`) REFERENCES `Users` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

SET @schema_name = DATABASE();
SET @has_order_quote = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='Orders' AND COLUMN_NAME='quotation_id');
SET @sql = IF(@has_order_quote=0, 'ALTER TABLE `Orders` ADD COLUMN `quotation_id` BIGINT UNSIGNED NULL AFTER `proforma_number`, ADD KEY `idx_orders_quotation` (`quotation_id`), ADD CONSTRAINT `fk_orders_quotation` FOREIGN KEY (`quotation_id`) REFERENCES `Quotations` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_detail_quote = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='Order_Details' AND COLUMN_NAME='quotation_detail_id');
SET @sql = IF(@has_detail_quote=0, 'ALTER TABLE `Order_Details` ADD COLUMN `quotation_detail_id` BIGINT UNSIGNED NULL AFTER `order_id`, ADD COLUMN `source_type` VARCHAR(15) NOT NULL DEFAULT ''MANUAL'' AFTER `quotation_detail_id`, ADD COLUMN `discount_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `unit_price`, ADD COLUMN `tax_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `discount_amount`, ADD KEY `idx_order_details_quotation_detail` (`quotation_detail_id`), ADD CONSTRAINT `fk_order_details_quotation_detail` FOREIGN KEY (`quotation_detail_id`) REFERENCES `QuotationDetails` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
