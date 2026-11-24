-- Índices para reducir el tiempo de bloqueo y las lecturas del registro de venta.
-- Es idempotente y no modifica datos ni contratos de la API.

SET @schema_name = DATABASE();

SET @sql = IF(
  EXISTS(
    SELECT 1
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'StockMovements'
      AND INDEX_NAME = 'idx_stock_movements_sale_reference'
  ),
  'SELECT 1',
  'CREATE INDEX `idx_stock_movements_sale_reference`
     ON `StockMovements` (`reference_type`, `reference_id`, `product_id`, `product_size_id`, `id`)'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(
    SELECT 1
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'CashRegisterSessions'
      AND INDEX_NAME = 'idx_cash_sessions_open_lookup'
  ),
  'SELECT 1',
  'CREATE INDEX `idx_cash_sessions_open_lookup`
     ON `CashRegisterSessions` (`warehouse_id`, `status`, `opened_at`, `id`)'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

