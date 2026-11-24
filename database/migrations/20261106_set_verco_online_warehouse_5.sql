-- La tienda pública verco-online utilizará el stock de Verco Central (warehouse 5).
-- El incremento de cache_version invalida cualquier catálogo del almacén anterior.
UPDATE `Storefronts`
SET `warehouse_id` = 5,
    `cache_version` = `cache_version` + 1
WHERE `slug` = 'verco-online'
  AND EXISTS (
    SELECT 1 FROM `Warehouses`
    WHERE `Warehouses`.`id` = 5 AND `Warehouses`.`status` = b'1'
  );
