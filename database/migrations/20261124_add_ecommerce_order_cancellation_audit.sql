-- Trazabilidad del rechazo/cancelación de pedidos ecommerce.
ALTER TABLE EcommerceOrders
  ADD COLUMN cancellation_reason VARCHAR(255) NULL AFTER stock_released_at,
  ADD COLUMN canceled_by INT NULL AFTER cancellation_reason,
  ADD COLUMN canceled_at_utc DATETIME(3) NULL AFTER canceled_by,
  ADD KEY idx_ecommerce_orders_canceled_by (canceled_by),
  ADD CONSTRAINT fk_ecommerce_orders_canceled_by
    FOREIGN KEY (canceled_by) REFERENCES Users(id) ON DELETE SET NULL;
