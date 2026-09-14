ALTER TABLE `Order_Details` DROP FOREIGN KEY `fk_order_details_quotation_detail`, DROP INDEX `idx_order_details_quotation_detail`, DROP COLUMN `tax_amount`, DROP COLUMN `discount_amount`, DROP COLUMN `source_type`, DROP COLUMN `quotation_detail_id`;
ALTER TABLE `Orders` DROP FOREIGN KEY `fk_orders_quotation`, DROP INDEX `idx_orders_quotation`, DROP COLUMN `quotation_id`;
DROP TABLE IF EXISTS `QuotationHistory`;
DROP TABLE IF EXISTS `QuotationDetails`;
DROP TABLE IF EXISTS `Quotations`;
DROP TABLE IF EXISTS `QuotationSequences`;
DROP TABLE IF EXISTS `OrderSequences`;
