# Samsara Starter — Busie Integration

Kafka consumer service, REST onboarding API, and ops scripts for the Busie × Samsara integration.

## Architecture Overview

```
Samsara Dashboard
      │  (Kafka Connector — SASL_SSL)
      ▼
Confluent Cloud Cluster (busie-samsara-prod)
  Topics: samsara.{customer_id}.{entity-slug}
      │
      ▼
samsara-consumer service (this repo)
  ├── Reads Kafka topics per customer
  ├── Maps samsara_asset_id → busie_vehicle_id
  ├── Writes telemetry to Postgres
  └── Extracts / generates live sharing links
      │
      ▼
Postgres (Busie DB)
```

## Project Structure

```
src/
  config.js               # Env-driven config (Kafka, DB, Secrets Manager)
  consumer/
    index.js              # Consumer entry point — one group per customer
    handlers/
      gpsLocations.js     # vehicle_locations writer
      engineStates.js     # vehicle_engine_states writer
      odometer.js         # vehicle_odometer writer
      routeEvents.js      # route_stop_actuals + live_sharing_links (Kafka path)
      vehicleEvents.js    # samsara_vehicle_map sync
      driverEvents.js     # drivers table sync
  db/
    migrate.js            # Migration runner
    migrations/           # SQL migration files (numbered)
    queries/
      vehicleLocations.js
      vehicleMap.js
      liveSharingLinks.js
  api/
    index.js              # Express app
    routes/
      onboarding.js       # POST /api/samsara/onboard — token intake + validation
      liveShare.js        # POST /api/samsara/live-share — REST path link generation
  services/
    vehicleMap.js         # samsara_asset_id → busie_vehicle_id lookup (cached)
    liveSharingLinks.js   # Link generation via Samsara REST API
    secretsManager.js     # AWS Secrets Manager wrapper

scripts/
  provision-topics.js     # Create all Kafka topics for a new customer
  init-vehicle-map.js     # Seed samsara_vehicle_map from GET /fleet/vehicles
```

## Getting Started

```bash
cp .env.example .env
# Fill in your Confluent credentials and DB URL

npm install
npm run migrate        # Run DB migrations
npm start              # Start Kafka consumer
```

## Scripts

```bash
# Provision Kafka topics for a new customer
node scripts/provision-topics.js --customer-id <id>

# Initialize vehicle ID mapping for a customer
node scripts/init-vehicle-map.js --customer-id <id>
```

## Environment Variables

See `.env.example` for all required variables.
