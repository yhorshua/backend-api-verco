-- El ecommerce nunca debe publicar el costo unit_price/factory_price como precio final.
-- Para las variantes 15525 actualmente publicadas, el precio comercial existente
-- en la intranet está registrado en manufacturing_cost.
UPDATE `Products`
SET `selling_price` = `manufacturing_cost`
WHERE `article_code` IN ('15525BD', '15525ZJ')
  AND (`selling_price` IS NULL OR `selling_price` <= 0)
  AND `manufacturing_cost` > 0;

UPDATE `Storefronts`
SET `cache_version` = `cache_version` + 1
WHERE `slug` = 'verco-online';
