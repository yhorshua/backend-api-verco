SET @schema_name = DATABASE();

SET @sql = IF(
  EXISTS(
    SELECT 1
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'StockMovements'
      AND INDEX_NAME = 'idx_stock_movements_sale_reference'
  ),
  'DROP INDEX `idx_stock_movements_sale_reference` ON `StockMovements`',
  'SELECT 1'
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
  'DROP INDEX `idx_cash_sessions_open_lookup` ON `CashRegisterSessions`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
