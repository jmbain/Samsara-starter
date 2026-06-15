'use strict';
const logger = require('../../logger');
const { lookupBusieVehicleId } = require('../../services/vehicleMap');
const db = require('../../db/queries/vehicleLocations');

/**
 * Handles messages from samsara.{customer_id}.gps-locations
 *
 * Expected payload shape (Samsara GPS Locations entity):
 * {
 *   happenedAtTime: "2024-01-15T10:30:00Z",
 *   asset: { id: "samsara-asset-id" },
 *   location: {
 *     latitude: 37.7749,
 *     longitude: -122.4194,
 *     headingDegrees: 180,
 *     address: { formattedAddress: "..." },
 *     geofence: { id: "..." }  // optional
 *   },
 *   speed: {
 *     gpsSpeedMetersPerSecond: 13.4,
 *     ecuSpeedMetersPerSecond: 13.2
 *   }
 * }
 */
async function handleGpsLocation({ customerId, payload, topic, offset }) {
  const samsaraAssetId = payload?.asset?.id;
  if (!samsaraAssetId) {
    logger.warn({ topic, offset, customerId }, 'GPS message missing asset.id — skipping');
    return;
  }

  const busieVehicleId = await lookupBusieVehicleId(customerId, samsaraAssetId);
  if (!busieVehicleId) {
    logger.warn({ customerId, samsaraAssetId }, 'No vehicle mapping found — skipping GPS record');
    // TODO: emit alert to admin review queue
    return;
  }

  await db.upsertVehicleLocation({
    customerId,
    busieVehicleId,
    samsaraAssetId,
    recordedAt: payload.happenedAtTime,
    lat: payload.location?.latitude,
    lng: payload.location?.longitude,
    headingDegrees: payload.location?.headingDegrees,
    gpsSpeedMs: payload.speed?.gpsSpeedMetersPerSecond,
    ecuSpeedMs: payload.speed?.ecuSpeedMetersPerSecond,
    addressJson: payload.location?.address ?? null,
    geofenceId: payload.location?.geofence?.id ?? null,
  });

  logger.info({ customerId, busieVehicleId, recordedAt: payload.happenedAtTime }, 'GPS location recorded');
}

module.exports = { handleGpsLocation };
