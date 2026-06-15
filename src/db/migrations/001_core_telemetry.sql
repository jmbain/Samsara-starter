-- Migration 001: Core telemetry tables
-- Run with: node src/db/migrate.js

-- Vehicle GPS locations
CREATE TABLE IF NOT EXISTS vehicle_locations (
  id              BIGSERIAL PRIMARY KEY,
  customer_id     UUID        NOT NULL,
  busie_vehicle_id UUID       NOT NULL,
  samsara_asset_id TEXT       NOT NULL,
  recorded_at     TIMESTAMPTZ NOT NULL,
  lat             NUMERIC(10, 6),
  lng             NUMERIC(10, 6),
  heading_degrees NUMERIC(5, 2),
  gps_speed_ms    NUMERIC(8, 3),
  ecu_speed_ms    NUMERIC(8, 3),
  address_json    JSONB,
  geofence_id     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (busie_vehicle_id, recorded_at)
);
CREATE INDEX IF NOT EXISTS idx_vehicle_locations_lookup
  ON vehicle_locations (customer_id, busie_vehicle_id, recorded_at DESC);

-- Vehicle odometer readings
CREATE TABLE IF NOT EXISTS vehicle_odometer (
  id                    BIGSERIAL PRIMARY KEY,
  customer_id           UUID        NOT NULL,
  busie_vehicle_id      UUID        NOT NULL,
  samsara_asset_id      TEXT        NOT NULL,
  recorded_at           TIMESTAMPTZ NOT NULL,
  odometer_meters_obd   BIGINT,
  odometer_meters_gps   BIGINT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (busie_vehicle_id, recorded_at)
);

-- Vehicle engine states (On / Off / Idle)
CREATE TABLE IF NOT EXISTS vehicle_engine_states (
  id               BIGSERIAL PRIMARY KEY,
  customer_id      UUID        NOT NULL,
  busie_vehicle_id UUID        NOT NULL,
  samsara_asset_id TEXT        NOT NULL,
  recorded_at      TIMESTAMPTZ NOT NULL,
  state            TEXT        NOT NULL CHECK (state IN ('On', 'Off', 'Idle')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (busie_vehicle_id, recorded_at)
);
CREATE INDEX IF NOT EXISTS idx_engine_states_lookup
  ON vehicle_engine_states (customer_id, busie_vehicle_id, recorded_at DESC);
