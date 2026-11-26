-- Solo ejecutar si no existen productos con series de más de un carácter.
ALTER TABLE Products
  MODIFY COLUMN article_series CHAR(1) NOT NULL;
