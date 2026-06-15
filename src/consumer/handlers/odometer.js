'use strict';
const logger = require('../../logger');
const { lookupBusieVehicleId } = require('../../services/vehicleMap');

/**
 * Handles messages from:
 *   samsara.{customer_id}.odometer-obd
 *   samsara.{customer_id}.odometer-gps
 *
 * Expected payload shape:
 * {
 *   happenedAtTime: "2024-01-15T10:30:00Z",
 *   asset: { id: "samsara-asset-id" },
 *   obdOdometerMeters: { value: 123456 }   // for odometer-obd topic
 *   // OR
 *   gpsOdometerMeters: { value: 123400 }   // for odometer-gps topic
 * }
 */
async function handleOdometer({ customerId, payload, topic, offset }) {
  const samsaraAssetId = payload?.asset?.id;
  if (!samsaraAssetId) {
    logger.warn({ topic, offset, customerId }, 'Odometer message missing asset.id — skipping');
    return;
  }

  const busieVehicleId = await lookupBusieVehicleId(customerId, samsaraAssetId);
  if (!busieVehicleId) {
    logger.warn({ customerId, samsaraAssetId }, 'No vehicle mapping found — skipping odometer');
    return;
  }

  const isObd = topic.endsWith('odometer-obd');
  const valueMeters = isObd
    ? payload.obdOdometerMeters?.value
    : payload.gpsOdometerMeters?.value;

  // TODO: upsert into vehicle_odometer table, storing both obd and gps columns
  logger.info({ customerId, busieVehicleId, isObd, valueMeters, recordedAt: payload.happenedAtTime }, 'Odometer recorded');
}

module.exports = { handleOdometer };
