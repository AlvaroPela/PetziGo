-- Migration: add_order_status_history.sql
-- Crea la tabla order_status_history para registrar cambios de estado de órdenes

CREATE TABLE IF NOT EXISTS order_status_history (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_id BIGINT NOT NULL,
  old_status VARCHAR(64) DEFAULT NULL,
  new_status VARCHAR(64) DEFAULT NULL,
  changed_by BIGINT DEFAULT NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (order_id),
  INDEX (changed_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
