-- Add provider-based live location to gps_locations
ALTER TABLE gps_locations
  ADD COLUMN provider_id INT NULL AFTER order_id,
  MODIFY COLUMN order_id INT NULL,
  ADD CONSTRAINT fk_gps_provider FOREIGN KEY (provider_id) REFERENCES provider_profiles(user_id),
  ADD UNIQUE KEY uniq_gps_provider (provider_id);
