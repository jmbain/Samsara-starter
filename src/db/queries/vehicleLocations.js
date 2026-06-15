'use strict';
const pool = require('../pool');

/**
 * Upsert a GPS location record.
 * Conflict key: (busie_vehicle_id, recorded_at) — deduplicate replayed messages.
 */
async function upsertVehicleLocation({
  customerId, busieVehicleId, samsaraAssetId,
  recordedAt, lat, lng, headingDegrees,
  gpsSpeedMs, ecuSpeedMs, addressJson, geofenceId,
}) {
  await pool.query(
    `INSERT INTO vehicle_locations
       (customer_id, busie_vehicle_id, samsara_asset_id, recorded_at,
        lat, lng, heading_degrees, gps_speed_ms, ecu_speed_ms, address_json, geofence_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (busie_vehicle_id, recorded_at) DO UPDATE SET
       lat = EXCLUDED.lat,
       lng = EXCLUDED.lng,
       heading_degrees = EXCLUDED.heading_degrees,
       gps_speed_ms = EXCLUDED.gps_speed_ms,
       ecu_speed_ms = EXCLUDED.ecu_speed_ms,
       address_json = EXCLUDED.address_json,
       geofence_id = EXCLUDED.geofence_id`,
    [customerId, busieVehicleId, samsaraAssetId, recordedAt,
     lat, lng, headingDegrees, gpsSpeedMs, ecuSpeedMs,
     addressJson ? JSON.stringify(addressJson) : null, geofenceId]
  );
}

module.exports = { upsertVehicleLocation };
