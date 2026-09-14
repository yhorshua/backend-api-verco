-- CRM WhatsApp: alinea el esquema existente con las entidades del backend.
-- No ejecutar sin revisar primero el resultado de las consultas de preflight.
-- La migración aborta si existen relaciones que no se pueden conservar.

DELIMITER $$
CREATE PROCEDURE migrate_crm_schema_20260912()
BEGIN
  IF EXISTS (
    SELECT 1 FROM asesor
    WHERE user_id IS NULL
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'CRM migration aborted: asesor.user_id contiene NULL';
  END IF;

  IF EXISTS (
    SELECT user_id FROM asesor
    GROUP BY user_id HAVING COUNT(*) > 1
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'CRM migration aborted: asesor.user_id contiene duplicados';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM asesor a
    LEFT JOIN Users u ON u.id = a.user_id
    WHERE u.id IS NULL
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'CRM migration aborted: existen asesores sin usuario válido';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM leads l
    LEFT JOIN asesor a ON a.id = l.asesor_id
    WHERE l.asesor_id IS NOT NULL AND a.id IS NULL
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'CRM migration aborted: leads no compatibles con la tabla asesor';
  END IF;

  ALTER TABLE asesor
    MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT,
    MODIFY COLUMN user_id INT NOT NULL,
    ADD CONSTRAINT uq_asesor_user UNIQUE (user_id),
    ADD CONSTRAINT fk_asesor_user
      FOREIGN KEY (user_id) REFERENCES Users(id)
      ON UPDATE CASCADE ON DELETE CASCADE;

  ALTER TABLE leads
    DROP FOREIGN KEY fk_leads_asesor,
    ADD COLUMN phone_number_id VARCHAR(100) NULL AFTER telefono,
    ADD COLUMN ultima_interaccion_cliente DATETIME NULL AFTER fecha,
    ADD COLUMN mensajes_no_leidos INT NOT NULL DEFAULT 0 AFTER ultima_interaccion_cliente,
    ADD COLUMN fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ON UPDATE CURRENT_TIMESTAMP AFTER mensajes_no_leidos,
    ADD COLUMN proxima_accion VARCHAR(255) NULL AFTER fecha_actualizacion,
    ADD COLUMN fecha_proximo_seguimiento DATETIME NULL AFTER proxima_accion,
    ADD COLUMN motivo_cierre VARCHAR(500) NULL AFTER fecha_proximo_seguimiento,
    ADD COLUMN fecha_cierre DATETIME NULL AFTER motivo_cierre,
    ADD CONSTRAINT uq_leads_numero_telefono UNIQUE (phone_number_id, telefono),
    ADD INDEX idx_leads_estado_fecha (estado, fecha),
    ADD INDEX idx_leads_seguimiento (fecha_proximo_seguimiento),
    ADD CONSTRAINT fk_leads_asesor_actual
      FOREIGN KEY (asesor_id) REFERENCES asesor(id)
      ON UPDATE CASCADE ON DELETE SET NULL;

  ALTER TABLE mensaje
    MODIFY COLUMN meta_message_id VARCHAR(255) NULL,
    MODIFY COLUMN fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN estado VARCHAR(20) NOT NULL DEFAULT 'received' AFTER direccion,
    ADD COLUMN error_meta TEXT NULL AFTER estado,
    ADD COLUMN fecha_meta DATETIME NULL AFTER error_meta,
    ADD CONSTRAINT uq_mensaje_meta_message_id UNIQUE (meta_message_id),
    ADD INDEX idx_mensaje_lead_fecha (lead_id, fecha);

  CREATE TABLE lead_historial (
    id BIGINT NOT NULL AUTO_INCREMENT,
    lead_id INT NOT NULL,
    usuario_id INT NOT NULL,
    estado_anterior VARCHAR(30) NOT NULL,
    estado_nuevo VARCHAR(30) NOT NULL,
    observacion VARCHAR(500) NULL,
    fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_lead_historial_lead_fecha (lead_id, fecha),
    INDEX idx_lead_historial_usuario (usuario_id),
    CONSTRAINT fk_lead_historial_lead
      FOREIGN KEY (lead_id) REFERENCES leads(id)
      ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_lead_historial_usuario
      FOREIGN KEY (usuario_id) REFERENCES Users(id)
      ON UPDATE CASCADE ON DELETE RESTRICT
  ) ENGINE=InnoDB;
END$$
DELIMITER ;

CALL migrate_crm_schema_20260912();
DROP PROCEDURE migrate_crm_schema_20260912;
