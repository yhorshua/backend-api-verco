UPDATE `Products`
SET `selling_price` = 0
WHERE `article_code` IN ('15525BD', '15525ZJ');

UPDATE `Storefronts`
SET `cache_version` = `cache_version` + 1
WHERE `slug` = 'verco-online';
