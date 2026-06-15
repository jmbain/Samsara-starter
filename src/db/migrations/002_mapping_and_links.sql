-- Migration 002: Integration mapping & live sharing link tables

-- Samsara asset ID → Busie vehicle ID mapping
CREATE TABLE IF NOT EXISTS samsara_vehicle_map (
  id               BIGSERIAL PRIMARY KEY,
  customer_id      UUID NOT NULL,
  samsara_asset_id TEXT NOT NULL,
  busie_vehicle_id UUID NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (customer_id, samsara_asset_id)
);
CREATE INDEX IF NOT EXISTS idx_vehicle_map_lookup
  ON samsara_vehicle_map (customer_id, samsara_asset_id);

-- Per-customer Samsara configuration
CREATE TABLE IF NOT EXISTS samsara_customers (
  customer_id             UUID PRIMARY KEY,
  uses_samsara_routing    BOOLEAN     NOT NULL DEFAULT FALSE,
  api_token_secret_path   TEXT,         -- e.g. busie/samsara/{customer_id}/api_token
  confluent_topic_prefix  TEXT,         -- e.g. samsara.{customer_id}
  onboarded_at            TIMESTAMPTZ,
  status                  TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','active','error','offboarded')),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Live sharing links (dual source: kafka | rest_api)
CREATE TABLE IF NOT EXISTS live_sharing_links (
  id                    BIGSERIAL PRIMARY KEY,
  customer_id           UUID        NOT NULL,
  busie_vehicle_id      UUID,
  samsara_asset_id      TEXT,
  busie_trip_id         UUID,
  samsara_route_stop_id TEXT,
  link_url              TEXT        NOT NULL,
  link_type             TEXT        NOT NULL CHECK (link_type IN ('routeStopLink','assetsLocation')),
  source                TEXT        NOT NULL CHECK (source IN ('kafka','rest_api')),
  expires_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (customer_id, busie_vehicle_id, samsara_route_stop_id, link_type)
);
