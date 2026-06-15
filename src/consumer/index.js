'use strict';
const { Kafka, logLevel } = require('kafkajs');
const config = require('../config');
const logger = require('../logger');
const { handleGpsLocation } = require('./handlers/gpsLocations');
const { handleEngineState } = require('./handlers/engineStates');
const { handleOdometer } = require('./handlers/odometer');
const { handleRouteEvent } = require('./handlers/routeEvents');
const { handleVehicleEvent } = require('./handlers/vehicleEvents');
const { handleDriverEvent } = require('./handlers/driverEvents');

// Map topic suffix → handler function
const HANDLERS = {
  'gps-locations': handleGpsLocation,
  'engine-states': handleEngineState,
  'odometer-obd': handleOdometer,
  'odometer-gps': handleOdometer,
  'route-events': handleRouteEvent,
  'vehicle-events': handleVehicleEvent,
  'driver-events': handleDriverEvent,
};

async function run() {
  const kafka = new Kafka({
    clientId: 'busie-samsara-consumer',
    brokers: config.kafka.brokers,
    ssl: config.kafka.ssl,
    sasl: config.kafka.sasl,
    logLevel: logLevel.WARN,
  });

  const consumer = kafka.consumer({
    // groupId is per-customer in production; for dev, a single group subscribes to all
    groupId: `${config.kafka.consumerGroupPrefix}-dev`,
  });

  await consumer.connect();
  logger.info('Kafka consumer connected');

  // Subscribe to all samsara.* topics (PREFIXED pattern requires broker config;
  // for dev, subscribe to specific topics as needed)
  await consumer.subscribe({ topics: /^samsara\..*/, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      // Extract entity slug from topic: samsara.{customer_id}.{entity-slug}
      const parts = topic.split('.');
      const customerId = parts[1];
      const entitySlug = parts.slice(2).join('.');

      const handler = HANDLERS[entitySlug];
      if (!handler) {
        logger.warn({ topic, entitySlug }, 'No handler registered for topic');
        return;
      }

      let payload;
      try {
        payload = JSON.parse(message.value.toString());
      } catch (err) {
        logger.error({ topic, partition, offset: message.offset.toString(), err }, 'Failed to parse message — routing to DLQ');
        // TODO: produce to samsara.{customerId}.dlq
        return;
      }

      try {
        await handler({ customerId, payload, topic, partition, offset: message.offset.toString() });
      } catch (err) {
        logger.error({ topic, partition, offset: message.offset.toString(), customerId, err }, 'Handler error — routing to DLQ');
        // TODO: produce to samsara.{customerId}.dlq
      }
    },
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    logger.info({ signal }, 'Shutting down consumer');
    await consumer.disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

run().catch((err) => {
  logger.error({ err }, 'Consumer failed to start');
  process.exit(1);
});
