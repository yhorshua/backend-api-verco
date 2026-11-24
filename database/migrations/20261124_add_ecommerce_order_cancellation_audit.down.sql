ALTER TABLE EcommerceOrders
  DROP FOREIGN KEY fk_ecommerce_orders_canceled_by,
  DROP INDEX idx_ecommerce_orders_canceled_by,
  DROP COLUMN canceled_at_utc,
  DROP COLUMN canceled_by,
  DROP COLUMN cancellation_reason;
