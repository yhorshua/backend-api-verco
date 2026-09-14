-- Amplia el historial existente de pagos y separa el estado financiero
-- del estado logistico/de devoluciones de Sales.

SET @schema_name = DATABASE();

SET @sql = IF(
  EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'SalePayments' AND COLUMN_NAME = 'payment_date'),
  'SELECT 1',
  'ALTER TABLE `SalePayments` ADD COLUMN `payment_date` DATE NULL AFTER `amount`'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'SalePayments' AND COLUMN_NAME = 'registered_by_user_id'),
  'SELECT 1',
  'ALTER TABLE `SalePayments` ADD COLUMN `registered_by_user_id` INT NULL AFTER `payment_date`'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'SalePayments' AND COLUMN_NAME = 'idempotency_key'),
  'SELECT 1',
  'ALTER TABLE `SalePayments` ADD COLUMN `idempotency_key` VARCHAR(36) NULL AFTER `registered_by_user_id`'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE `SalePayments` sp
INNER JOIN `Sales` s ON s.id = sp.sale_id
SET sp.payment_date = COALESCE(
      sp.payment_date,
      DATE(CONVERT_TZ(sp.created_at, 'UTC', 'America/Lima'))
    ),
    sp.registered_by_user_id = COALESCE(sp.registered_by_user_id, s.user_id)
WHERE sp.payment_date IS NULL OR sp.registered_by_user_id IS NULL;

-- Los pagos históricos y adelantos iniciales no tienen clave idempotente.
-- Su fecha se deriva de created_at convirtiendo UTC a hora de Lima.
UPDATE `SalePayments`
SET payment_date = DATE(CONVERT_TZ(created_at, 'UTC', 'America/Lima'))
WHERE idempotency_key IS NULL;

ALTER TABLE `SalePayments`
  MODIFY COLUMN `payment_date` DATE NULL,
  MODIFY COLUMN `registered_by_user_id` INT NULL;

SET @sql = IF(
  EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'Sales' AND COLUMN_NAME = 'payment_status'),
  'SELECT 1',
  'ALTER TABLE `Sales` ADD COLUMN `payment_status` VARCHAR(20) NOT NULL DEFAULT ''PAID'' AFTER `fecha_proximo_pago`'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE `Sales`
SET payment_status = CASE
  WHEN payment_method = 'credito' AND monto_restante > 0 THEN 'PENDING'
  ELSE 'PAID'
END;

SET @sql = IF(
  EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'SalePayments' AND INDEX_NAME = 'uq_sale_payments_idempotency'),
  'SELECT 1',
  'CREATE UNIQUE INDEX `uq_sale_payments_idempotency` ON `SalePayments` (`idempotency_key`)'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'SalePayments' AND INDEX_NAME = 'idx_sale_payments_user_date'),
  'SELECT 1',
  'CREATE INDEX `idx_sale_payments_user_date` ON `SalePayments` (`registered_by_user_id`, `payment_date`)'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'Sales' AND INDEX_NAME = 'idx_sales_pending_payments'),
  'SELECT 1',
  'CREATE INDEX `idx_sales_pending_payments` ON `Sales` (`warehouse_id`, `payment_method`, `payment_status`, `fecha_proximo_pago`)'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = @schema_name AND TABLE_NAME = 'SalePayments' AND CONSTRAINT_NAME = 'fk_sale_payments_registered_user'),
  'SELECT 1',
  'ALTER TABLE `SalePayments` ADD CONSTRAINT `fk_sale_payments_registered_user` FOREIGN KEY (`registered_by_user_id`) REFERENCES `Users` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = @schema_name AND TABLE_NAME = 'Sales' AND CONSTRAINT_NAME = 'chk_sales_payment_status'),
  'SELECT 1',
  'ALTER TABLE `Sales` ADD CONSTRAINT `chk_sales_payment_status` CHECK (`payment_status` IN (''PENDING'', ''PAID''))'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
