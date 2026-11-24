-- Reversión segura: no elimina el warehouse si ya tiene stock u otras referencias.
START TRANSACTION;
DELETE FROM Storefronts
WHERE slug = 'soomin-store'
  AND NOT EXISTS (SELECT 1 FROM EcommerceOrders WHERE storefront_id = Storefronts.id);
DELETE FROM Warehouses
WHERE warehouse_name = 'Soomin Store Ecommerce'
  AND NOT EXISTS (SELECT 1 FROM Stock WHERE warehouse_id = Warehouses.id)
  AND NOT EXISTS (SELECT 1 FROM Storefronts WHERE warehouse_id = Warehouses.id)
  AND NOT EXISTS (SELECT 1 FROM EcommerceOrders WHERE warehouse_id = Warehouses.id);
COMMIT;
