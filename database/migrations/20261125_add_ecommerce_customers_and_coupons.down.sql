DROP TABLE IF EXISTS EcommerceCouponRedemptions;
DROP TABLE IF EXISTS EcommerceCoupons;
ALTER TABLE EcommerceOrders DROP FOREIGN KEY fk_ecommerce_orders_customer, DROP INDEX idx_ecommerce_orders_customer, DROP COLUMN customer_id;
DROP TABLE IF EXISTS EcommerceCustomers;
