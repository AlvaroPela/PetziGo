-- Agrega la columna para guardar el id del pago de MercadoPago
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS mercadopago_payment_id VARCHAR(255) DEFAULT NULL;

-- Índice opcional para búsquedas por payment id
CREATE INDEX IF NOT EXISTS idx_orders_mp_payment_id ON orders(mercadopago_payment_id);
