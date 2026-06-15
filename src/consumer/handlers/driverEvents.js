'use strict';
const logger = require('../../logger');

/**
 * Handles messages from samsara.{customer_id}.driver-events
 *
 * Subtypes handled: DriverCreated, DriverUpdated, DriverDeleted (soft)
 */
async function handleDriverEvent({ customerId, payload, topic, offset }) {
  const eventType = payload?.eventType;
  const driver = payload?.driver;

  if (!driver?.id) {
    logger.warn({ topic, offset, eventType }, 'Driver event missing driver.id — skipping');
    return;
  }

  // TODO:
  // - On DriverCreated/Updated: upsert in drivers table
  // - On DriverDeleted: soft-delete (set deleted_at)

  logger.info({ customerId, eventType, driverId: driver.id, name: driver.name }, 'Driver event processed');
}

module.exports = { handleDriverEvent };
