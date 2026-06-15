'use strict';
const pool = require('../pool');

/**
 * Look up busie_vehicle_id for a given Samsara asset ID.
 * Returns null if no mapping exists.
 */
async function findBusieVehicleId(customerId, samsaraAssetId) {
  const result = await pool.query(
    `SELECT busie_vehicle_id
     FROM samsara_vehicle_map
     WHERE customer_id = $1 AND samsara_asset_id = $2
     LIMIT 1`,
    [customerId, samsaraAssetId]
  );
  return result.rows[0]?.busie_vehicle_id ?? null;
}

/**
 * Upsert a vehicle mapping (used during onboarding and vehicle event processing).
 */
async function upsertMapping({ customerId, samsaraAssetId, busieVehicleId }) {
  await pool.query(
    `INSERT INTO samsara_vehicle_map (customer_id, samsara_asset_id, busie_vehicle_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (customer_id, samsara_asset_id)
     DO UPDATE SET busie_vehicle_id = EXCLUDED.busie_vehicle_id, updated_at = NOW()`,
    [customerId, samsaraAssetId, busieVehicleId]
  );
}

module.exports = { findBusieVehicleId, upsertMapping };
