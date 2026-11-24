-- Datos de entrega, pago y trazabilidad requeridos por Soomin Store.
-- Ejecutar después de 20261106_add_ecommerce_storefront.sql y
-- 20261123_add_soomin_product_commercial_fields.sql.

ALTER TABLE EcommerceOrders
  ADD COLUMN department_code VARCHAR(6) NULL AFTER department,
  ADD COLUMN province_code VARCHAR(6) NULL AFTER province,
  ADD COLUMN district_code VARCHAR(6) NULL AFTER district,
  ADD COLUMN delivery_type VARCHAR(30) NOT NULL DEFAULT 'DOMICILIO_LIMA' AFTER reference,
  ADD COLUMN shalom_agency_id VARCHAR(40) NULL AFTER delivery_type,
  ADD COLUMN shalom_agency_name VARCHAR(180) NULL AFTER shalom_agency_id,
  ADD COLUMN shipping_code VARCHAR(80) NULL AFTER shalom_agency_name,
  ADD COLUMN payment_status VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' AFTER payment_method;

ALTER TABLE EcommerceOrderDetails
  ADD COLUMN image_url_snapshot VARCHAR(500) NULL AFTER size_snapshot;
