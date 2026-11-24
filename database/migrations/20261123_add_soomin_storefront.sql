-- Tienda ecommerce Soomin independiente de Verco Online y de WebSales.
-- No copia stock: cada producto/talla debe cargarse explícitamente en este warehouse.
START TRANSACTION;

INSERT INTO Warehouses (warehouse_name, type, location, status, cantidad_pares, monto)
SELECT 'Soomin Store Ecommerce', 'tienda', 'Ecommerce Soomin Store', b'1', 0, 0.00
WHERE NOT EXISTS (
  SELECT 1 FROM Warehouses WHERE warehouse_name = 'Soomin Store Ecommerce'
);

SET @soomin_warehouse_id := (
  SELECT id FROM Warehouses
  WHERE warehouse_name = 'Soomin Store Ecommerce' AND status = b'1'
  ORDER BY id LIMIT 1
);

INSERT INTO Storefronts
  (slug, name, warehouse_id, currency, cache_version, cache_ttl_seconds, status)
SELECT
  'soomin-store', 'Soomin Store', @soomin_warehouse_id, 'PEN', 1, 60, b'1'
WHERE @soomin_warehouse_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM Storefronts WHERE slug = 'soomin-store');

COMMIT;
