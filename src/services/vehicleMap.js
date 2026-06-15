'use strict';
const db = require('../db/queries/vehicleMap');
const logger = require('../logger');

// Simple in-process cache to avoid repeated DB hits for stable mappings
// Key: `${customerId}:${samsaraAssetId}`  Value: busieVehicleId
const cache = new Map();

/**
 * Look up the Busie vehicle ID for a given Samsara asset ID.
 * Returns null if no mapping exists — callers should skip and alert.
 */
async function lookupBusieVehicleId(customerId, samsaraAssetId) {
  const cacheKey = `${customerId}:${samsaraAssetId}`;

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const busieVehicleId = await db.findBusieVehicleId(customerId, samsaraAssetId);

  if (busieVehicleId) {
    cache.set(cacheKey, busieVehicleId);
  } else {
    logger.warn({ customerId, samsaraAssetId }, 'samsara_vehicle_map: no mapping found');
  }

  return busieVehicleId;
}

/** Invalidate cache entry (e.g. after a vehicle mapping update event) */
function invalidate(customerId, samsaraAssetId) {
  cache.delete(`${customerId}:${samsaraAssetId}`);
}

module.exports = { lookupBusieVehicleId, invalidate };
