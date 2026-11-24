ALTER TABLE EcommerceOrders DROP COLUMN shipping_amount;
ALTER TABLE Products DROP COLUMN shipping_cost;
-- La categoría no se elimina porque puede haber sido utilizada después de la migración.
