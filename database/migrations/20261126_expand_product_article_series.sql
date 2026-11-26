-- Permite las series ecommerce SMR, SMA y SMC sin afectar las series numéricas existentes.
ALTER TABLE Products
  MODIFY COLUMN article_series VARCHAR(30) NOT NULL;
