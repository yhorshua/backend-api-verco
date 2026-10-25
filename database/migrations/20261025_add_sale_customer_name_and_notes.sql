SET @schema_name = DATABASE();

SET @add_customer_name = IF(
  EXISTS(
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'Sales'
      AND COLUMN_NAME = 'customer_name'
  ),
  'SELECT 1',
  'ALTER TABLE `Sales` ADD COLUMN `customer_name` VARCHAR(150) NULL AFTER `customer_id`'
);
PREPARE statement FROM @add_customer_name;
EXECUTE statement;
DEALLOCATE PREPARE statement;

SET @add_notes = IF(
  EXISTS(
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'Sales'
      AND COLUMN_NAME = 'notes'
  ),
  'SELECT 1',
  'ALTER TABLE `Sales` ADD COLUMN `notes` VARCHAR(500) NULL AFTER `customer_name`'
);
PREPARE statement FROM @add_notes;
EXECUTE statement;
DEALLOCATE PREPARE statement;
