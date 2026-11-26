CREATE TABLE EcommerceCustomers (
 id INT NOT NULL AUTO_INCREMENT, storefront_id INT NOT NULL, google_subject VARCHAR(255) NOT NULL,
 email VARCHAR(190) NOT NULL, email_verified BIT NOT NULL DEFAULT b'1', full_name VARCHAR(180) NOT NULL,
 picture_url VARCHAR(500) NULL, phone VARCHAR(30) NULL, document_type VARCHAR(10) NULL,
 document_number VARCHAR(20) NULL, address VARCHAR(255) NULL, department VARCHAR(100) NULL,
 department_code VARCHAR(6) NULL, province VARCHAR(100) NULL, province_code VARCHAR(6) NULL,
 district VARCHAR(100) NULL, district_code VARCHAR(6) NULL, marketing_consent BIT NOT NULL DEFAULT b'0',
 privacy_accepted_at_utc DATETIME(3) NULL, last_login_at_utc DATETIME(3) NOT NULL,
 status BIT NOT NULL DEFAULT b'1', created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 PRIMARY KEY(id), UNIQUE KEY uq_ecommerce_customer_google(storefront_id,google_subject),
 UNIQUE KEY uq_ecommerce_customer_email(storefront_id,email),
 CONSTRAINT fk_ecommerce_customer_store FOREIGN KEY(storefront_id) REFERENCES Storefronts(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE EcommerceOrders ADD COLUMN customer_id INT NULL AFTER warehouse_id,
 ADD KEY idx_ecommerce_orders_customer(customer_id),
 ADD CONSTRAINT fk_ecommerce_orders_customer FOREIGN KEY(customer_id) REFERENCES EcommerceCustomers(id) ON DELETE SET NULL;

CREATE TABLE EcommerceCoupons (
 id INT NOT NULL AUTO_INCREMENT, storefront_id INT NOT NULL, code VARCHAR(40) NOT NULL,
 description VARCHAR(255) NULL, discount_type ENUM('PERCENT','FIXED') NOT NULL,
 discount_value DECIMAL(12,2) NOT NULL, minimum_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
 maximum_discount DECIMAL(12,2) NULL, starts_at_utc DATETIME(3) NOT NULL, ends_at_utc DATETIME(3) NOT NULL,
 total_usage_limit INT NULL, usage_limit_per_customer INT NOT NULL DEFAULT 1,
 first_order_only BIT NOT NULL DEFAULT b'0', combinable_with_product_discount BIT NOT NULL DEFAULT b'0',
 status BIT NOT NULL DEFAULT b'1', created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 PRIMARY KEY(id), UNIQUE KEY uq_ecommerce_coupon_code(storefront_id,code),
 KEY idx_ecommerce_coupon_active(storefront_id,status,starts_at_utc,ends_at_utc),
 CONSTRAINT fk_ecommerce_coupon_store FOREIGN KEY(storefront_id) REFERENCES Storefronts(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE EcommerceCouponRedemptions (
 id INT NOT NULL AUTO_INCREMENT, coupon_id INT NOT NULL, customer_id INT NOT NULL, order_id INT NOT NULL,
 discount_amount DECIMAL(12,2) NOT NULL, redeemed_at_utc DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(id), UNIQUE KEY uq_coupon_redemption_order(order_id), KEY idx_coupon_customer(coupon_id,customer_id),
 CONSTRAINT fk_redemption_coupon FOREIGN KEY(coupon_id) REFERENCES EcommerceCoupons(id) ON DELETE RESTRICT,
 CONSTRAINT fk_redemption_customer FOREIGN KEY(customer_id) REFERENCES EcommerceCustomers(id) ON DELETE RESTRICT,
 CONSTRAINT fk_redemption_order FOREIGN KEY(order_id) REFERENCES EcommerceOrders(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
