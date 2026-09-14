-- Reversion de 20260912_add_pending_payment_tracking.sql.
-- Ejecutar solo si el modulo aun no ha registrado pagos con estos campos.

ALTER TABLE `SalePayments` DROP FOREIGN KEY `fk_sale_payments_registered_user`;
ALTER TABLE `Sales` DROP CHECK `chk_sales_payment_status`;
DROP INDEX `idx_sales_pending_payments` ON `Sales`;
DROP INDEX `idx_sale_payments_user_date` ON `SalePayments`;
DROP INDEX `uq_sale_payments_idempotency` ON `SalePayments`;
ALTER TABLE `Sales` DROP COLUMN `payment_status`;
ALTER TABLE `SalePayments`
  DROP COLUMN `idempotency_key`,
  DROP COLUMN `registered_by_user_id`,
  DROP COLUMN `payment_date`;
