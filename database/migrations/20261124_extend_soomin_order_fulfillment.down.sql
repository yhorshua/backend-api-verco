ALTER TABLE EcommerceOrderDetails DROP COLUMN image_url_snapshot;
ALTER TABLE EcommerceOrders
  DROP COLUMN payment_status,
  DROP COLUMN shipping_code,
  DROP COLUMN shalom_agency_name,
  DROP COLUMN shalom_agency_id,
  DROP COLUMN delivery_type,
  DROP COLUMN district_code,
  DROP COLUMN province_code,
  DROP COLUMN department_code;
