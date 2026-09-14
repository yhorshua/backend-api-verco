-- payment_method ya representa el tipo de pago y admitirá el valor "credito".
-- Esta migración amplía la tabla existente; no crea tablas nuevas.
ALTER TABLE `Sales`
  ADD COLUMN `monto_adelanto` DECIMAL(10, 2) NOT NULL DEFAULT 0.00 AFTER `payment_method`,
  ADD COLUMN `metodo_pago_adelanto` VARCHAR(20) NULL AFTER `monto_adelanto`,
  ADD COLUMN `monto_restante` DECIMAL(10, 2) NOT NULL DEFAULT 0.00 AFTER `metodo_pago_adelanto`,
  ADD COLUMN `fecha_proximo_pago` DATE NULL AFTER `monto_restante`;
