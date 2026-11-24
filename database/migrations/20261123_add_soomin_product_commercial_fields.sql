-- Campos comerciales para ecommerce. Migración aditiva.
ALTER TABLE Products
  ADD COLUMN shipping_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER original_price;

ALTER TABLE EcommerceOrders
  ADD COLUMN shipping_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER total_amount;

INSERT INTO Categories (name, description)
SELECT 'Ropa para niña', 'Ropa infantil para niña, tallas referenciales del 2 al 16'
WHERE NOT EXISTS (
  SELECT 1 FROM Categories WHERE LOWER(TRIM(name)) = 'ropa para niña'
);
