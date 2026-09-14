-- Reversión segura de 20260913_add_inventory_adjustment_audit.sql.
-- Ejecutar únicamente si no se requiere conservar el historial generado.
DROP TABLE IF EXISTS `InventoryAdjustmentDetails`;
DROP TABLE IF EXISTS `InventoryAdjustmentOperations`;
ALTER TABLE `Stock` DROP COLUMN `updated_at_utc`, DROP COLUMN `version`;
