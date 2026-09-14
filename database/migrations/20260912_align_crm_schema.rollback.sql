-- Reversión estructural. Conserva leads y mensajes; elimina únicamente
-- la tabla de historial y las columnas introducidas por la migración CRM.

DROP TABLE IF EXISTS lead_historial;

ALTER TABLE mensaje
  DROP INDEX idx_mensaje_lead_fecha,
  DROP INDEX uq_mensaje_meta_message_id,
  DROP COLUMN fecha_meta,
  DROP COLUMN error_meta,
  DROP COLUMN estado,
  MODIFY COLUMN meta_message_id VARCHAR(200) NULL,
  MODIFY COLUMN fecha DATETIME NULL;

ALTER TABLE leads
  DROP FOREIGN KEY fk_leads_asesor_actual,
  DROP INDEX idx_leads_seguimiento,
  DROP INDEX idx_leads_estado_fecha,
  DROP INDEX uq_leads_numero_telefono,
  DROP COLUMN fecha_cierre,
  DROP COLUMN motivo_cierre,
  DROP COLUMN fecha_proximo_seguimiento,
  DROP COLUMN proxima_accion,
  DROP COLUMN fecha_actualizacion,
  DROP COLUMN mensajes_no_leidos,
  DROP COLUMN ultima_interaccion_cliente,
  DROP COLUMN phone_number_id,
  ADD CONSTRAINT fk_leads_asesor
    FOREIGN KEY (asesor_id) REFERENCES asesores(id);

ALTER TABLE asesor
  DROP FOREIGN KEY fk_asesor_user,
  DROP INDEX uq_asesor_user,
  MODIFY COLUMN user_id INT NULL,
  MODIFY COLUMN id INT NOT NULL;
