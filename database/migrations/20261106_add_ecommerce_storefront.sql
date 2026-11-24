-- Canal ecommerce independiente de WebSales (la cual permanece para la intranet).
-- Migración aditiva y compatible con los registros existentes.

ALTER TABLE `Products`
  ADD COLUMN `ecommerce_group_code` VARCHAR(50) NULL AFTER `model_code`,
  ADD COLUMN `color_code` VARCHAR(20) NULL AFTER `ecommerce_group_code`,
  ADD INDEX `idx_products_ecommerce_group` (`ecommerce_group_code`),
  ADD INDEX `idx_products_ecommerce_catalog` (`is_published`, `status`);

CREATE TABLE `Storefronts` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `slug` VARCHAR(80) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `warehouse_id` INT NOT NULL,
  `currency` CHAR(3) NOT NULL DEFAULT 'PEN',
  `cache_version` INT UNSIGNED NOT NULL DEFAULT 1,
  `cache_ttl_seconds` INT UNSIGNED NOT NULL DEFAULT 60,
  `status` BIT(1) NOT NULL DEFAULT b'1',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_storefronts_slug` (`slug`),
  KEY `idx_storefronts_warehouse` (`warehouse_id`),
  CONSTRAINT `fk_storefronts_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `Warehouses` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `EcommerceOrders` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `order_code` VARCHAR(30) NULL,
  `idempotency_key` VARCHAR(80) NOT NULL,
  `storefront_id` INT NOT NULL,
  `warehouse_id` INT NOT NULL,
  `customer_name` VARCHAR(150) NOT NULL,
  `customer_document` VARCHAR(20) NOT NULL,
  `customer_phone` VARCHAR(30) NOT NULL,
  `customer_address` VARCHAR(255) NOT NULL,
  `department` VARCHAR(100) NOT NULL,
  `province` VARCHAR(100) NOT NULL,
  `district` VARCHAR(100) NOT NULL,
  `reference` VARCHAR(255) NULL,
  `payment_method` VARCHAR(30) NOT NULL,
  `currency` CHAR(3) NOT NULL DEFAULT 'PEN',
  `total_amount` DECIMAL(12,2) NOT NULL,
  `observations` TEXT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
  `stock_committed_at` DATETIME NOT NULL,
  `stock_released_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ecommerce_orders_code` (`order_code`),
  UNIQUE KEY `uq_ecommerce_orders_idempotency` (`idempotency_key`),
  KEY `idx_ecommerce_orders_store_status_date` (`storefront_id`, `status`, `created_at`),
  KEY `idx_ecommerce_orders_warehouse` (`warehouse_id`),
  CONSTRAINT `fk_ecommerce_orders_storefront` FOREIGN KEY (`storefront_id`) REFERENCES `Storefronts` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_ecommerce_orders_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `Warehouses` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `EcommerceOrderDetails` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `order_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `product_size_id` INT NOT NULL,
  `quantity` INT UNSIGNED NOT NULL,
  `unit_price` DECIMAL(12,2) NOT NULL,
  `subtotal` DECIMAL(12,2) NOT NULL,
  `article_code_snapshot` VARCHAR(80) NOT NULL,
  `product_name_snapshot` VARCHAR(255) NOT NULL,
  `color_snapshot` VARCHAR(80) NULL,
  `size_snapshot` VARCHAR(30) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ecommerce_order_details_order` (`order_id`),
  KEY `idx_ecommerce_order_details_product_size` (`product_id`, `product_size_id`),
  CONSTRAINT `fk_ecommerce_order_details_order` FOREIGN KEY (`order_id`) REFERENCES `EcommerceOrders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ecommerce_order_details_product` FOREIGN KEY (`product_id`) REFERENCES `Products` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_ecommerce_order_details_size` FOREIGN KEY (`product_size_id`) REFERENCES `ProductSize` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Configuración inicial: el almacén de producto terminado. Se puede crear una
-- fila adicional por tienda/warehouse sin duplicar productos, precios ni fotos.
INSERT INTO `Storefronts` (`slug`, `name`, `warehouse_id`)
SELECT 'verco-online', 'Verco Online', w.id
FROM `Warehouses` w
WHERE w.status = b'1' AND UPPER(w.type) = 'PRODUCTO_TERMINADO'
ORDER BY w.id
LIMIT 1;
