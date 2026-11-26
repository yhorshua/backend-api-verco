-- Registra el cálculo comercial aplicado a conjuntos de Soomin Store.
-- El descuento se calcula exclusivamente en el backend con importes en centavos.

ALTER TABLE EcommerceOrders
  ADD COLUMN subtotal_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER total_amount,
  ADD COLUMN discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER subtotal_amount,
  ADD COLUMN bundle_discount_percent INT UNSIGNED NOT NULL DEFAULT 0 AFTER discount_amount;

UPDATE EcommerceOrders
SET subtotal_amount = GREATEST(total_amount - shipping_amount, 0.00)
WHERE subtotal_amount = 0.00;
