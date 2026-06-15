'use strict';
const logger = require('../../logger');

/**
 * Handles messages from samsara.{customer_id}.vehicle-events
 *
 * Subtypes handled: VehicleCreated, VehicleUpdated, VehicleDeleted (soft)
 */
async function handleVehicleEvent({ customerId, payload, topic, offset }) {
  const eventType = payload?.eventType;
  const vehicle = payload?.vehicle;

  if (!vehicle?.id) {
    logger.warn({ topic, offset, eventType }, 'Vehicle event missing vehicle.id — skipping');
    return;
  }

  // TODO:
  // - On VehicleCreated: upsert samsara_vehicle_map; alert if VIN clash
  // - On VehicleUpdated: update samsara_vehicle_map metadata (name, VIN, plate)
  // - On VehicleDeleted: soft-delete (set deleted_at) — never hard-delete

  logger.info({ customerId, eventType, samsaraAssetId: vehicle.id, vin: vehicle.vin }, 'Vehicle event processed');
}

module.exports = { handleVehicleEvent };
