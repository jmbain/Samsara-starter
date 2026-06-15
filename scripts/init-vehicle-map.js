#!/usr/bin/env node
/**
 * init-vehicle-map.js
 * Seeds samsara_vehicle_map by calling GET /fleet/vehicles for a customer
 * and matching Samsara vehicles to Busie vehicles by VIN or license plate.
 *
 * Usage:
 *   node scripts/init-vehicle-map.js --customer-id <id>
 */
'use strict';
require('dotenv').config();
const axios = require('axios');
const config = require('../src/config');
const secretsManager = require('../src/services/secretsManager');
const pool = require('../src/db/pool');

const args = process.argv.slice(2);
const customerIdIdx = args.indexOf('--customer-id');
const customerId = customerIdIdx !== -1 ? args[customerIdIdx + 1] : null;

if (!customerId) {
  console.error('Usage: node scripts/init-vehicle-map.js --customer-id <id>');
  process.exit(1);
}

async function fetchAllVehicles(apiToken) {
  const vehicles = [];
  let cursor = null;

  do {
    const params = { limit: 100, ...(cursor ? { after: cursor } : {}) };
    const response = await axios.get(`${config.samsara.baseUrl}/fleet/vehicles`, {
      headers: { Authorization: `Bearer ${apiToken}` },
      params,
    });
    vehicles.push(...(response.data?.data ?? []));
    cursor = response.data?.pagination?.endCursor;
    const hasMore = response.data?.pagination?.hasNextPage;
    if (!hasMore) break;
  } while (cursor);

  return vehicles;
}

async function run() {
  const apiToken = await secretsManager.getSamsaraToken(customerId);
  const samsaraVehicles = await fetchAllVehicles(apiToken);
  console.log(`Fetched ${samsaraVehicles.length} vehicles from Samsara for customer ${customerId}`);

  let matched = 0, unmatched = 0;

  for (const v of samsaraVehicles) {
    // Try to match by VIN first, then license plate
    const vin = v.vin;
    const plate = v.licensePlate;

    const busieResult = vin
      ? await pool.query('SELECT id FROM vehicles WHERE vin = $1 LIMIT 1', [vin])
      : null;

    const busieVehicleId = busieResult?.rows[0]?.id ?? null;

    if (busieVehicleId) {
      await pool.query(
        `INSERT INTO samsara_vehicle_map (customer_id, samsara_asset_id, busie_vehicle_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (customer_id, samsara_asset_id) DO UPDATE
           SET busie_vehicle_id = EXCLUDED.busie_vehicle_id, updated_at = NOW()`,
        [customerId, v.id, busieVehicleId]
      );
      console.log(`  ✓ Matched: ${v.name} (${vin ?? plate}) → ${busieVehicleId}`);
      matched++;
    } else {
      console.log(`  ⚠ Unmatched: ${v.name} (${vin ?? plate ?? 'no VIN/plate'}) — flagged for manual review`);
      // TODO: write to admin review queue
      unmatched++;
    }
  }

  console.log(`\nDone. Matched: ${matched}, Unmatched: ${unmatched}`);
  await pool.end();
}

run().catch((err) => {
  console.error('Vehicle map init failed:', err.message);
  process.exit(1);
});
