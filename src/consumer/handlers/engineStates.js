'use strict';
const logger = require('../../logger');
const { lookupBusieVehicleId } = require('../../services/vehicleMap');

/**
 * Handles messages from samsara.{customer_id}.engine-states
 *
 * Expected payload shape:
 * {
 *   happenedAtTime: "2024-01-15T10:30:00Z",
 *   asset: { id: "samsara-asset-id" },
 *   engineState: { value: "On" | "Off" | "Idle" }
 * }
 */
async function handleEngineState({ customerId, payload, topic, offset }) {
  const samsaraAssetId = payload?.asset?.id;
  if (!samsaraAssetId) {
    logger.warn({ topic, offset, customerId }, 'Engine state message missing asset.id — skipping');
    return;
  }

  const busieVehicleId = await lookupBusieVehicleId(customerId, samsaraAssetId);
  if (!busieVehicleId) {
    logger.warn({ customerId, samsaraAssetId }, 'No vehicle mapping found — skipping engine state');
    return;
  }

  const state = payload.engineState?.value;
  if (!state) {
    logger.warn({ topic, offset }, 'Engine state message missing engineState.value — skipping');
    return;
  }

  // TODO: upsert into vehicle_engine_states table
  logger.info({ customerId, busieVehicleId, state, recordedAt: payload.happenedAtTime }, 'Engine state recorded');
}

module.exports = { handleEngineState };
