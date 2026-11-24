-- Reversión al almacén de producto terminado usado originalmente.
UPDATE `Storefronts`
SET `warehouse_id` = 6,
    `cache_version` = `cache_version` + 1
WHERE `slug` = 'verco-online'
  AND EXISTS (
    SELECT 1 FROM `Warehouses`
    WHERE `Warehouses`.`id` = 6 AND `Warehouses`.`status` = b'1'
  );
