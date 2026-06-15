#!/usr/bin/env node
/**
 * provision-topics.js
 * Creates all required Kafka topics for a new Samsara customer.
 *
 * Usage:
 *   node scripts/provision-topics.js --customer-id <id>
 *
 * Requires KAFKA_BOOTSTRAP_SERVERS, KAFKA_API_KEY, KAFKA_API_SECRET in env (or .env).
 */
'use strict';
require('dotenv').config();
const { Kafka } = require('kafkajs');
const config = require('../src/config');

const args = process.argv.slice(2);
const customerIdIdx = args.indexOf('--customer-id');
const customerId = customerIdIdx !== -1 ? args[customerIdIdx + 1] : null;

if (!customerId) {
  console.error('Usage: node scripts/provision-topics.js --customer-id <id>');
  process.exit(1);
}

// All entity slugs from the Samsara Kafka connector
const ENTITIES = [
  // Priority 1
  { slug: 'gps-locations',       retention: 7 },
  { slug: 'engine-states',       retention: 7 },
  { slug: 'odometer-obd',        retention: 7 },
  { slug: 'odometer-gps',        retention: 7 },
  { slug: 'route-events',        retention: 14 },
  { slug: 'vehicle-events',      retention: 14 },
  { slug: 'driver-events',       retention: 14 },
  // Priority 2
  { slug: 'engine-hours',        retention: 7 },
  { slug: 'fuel-levels',         retention: 7 },
  { slug: 'fault-codes',         retention: 7 },
  { slug: 'geofence-events',     retention: 14 },
  { slug: 'dvir-events',         retention: 14 },
  { slug: 'safety-events',       retention: 14 },
  // Priority 3
  { slug: 'driver-hos-logs',     retention: 30 },
  { slug: 'driver-vehicle-roster', retention: 14 },
];

const PARTITIONS = 6;
const REPLICATION_FACTOR = 3;

async function run() {
  const kafka = new Kafka({
    clientId: 'busie-topic-provisioner',
    brokers: config.kafka.brokers,
    ssl: config.kafka.ssl,
    sasl: config.kafka.sasl,
  });

  const admin = kafka.admin();
  await admin.connect();
  console.log(`Connected. Provisioning ${ENTITIES.length} topics for customer: ${customerId}`);

  const topics = ENTITIES.map(({ slug, retention }) => ({
    topic: `samsara.${customerId}.${slug}`,
    numPartitions: PARTITIONS,
    replicationFactor: REPLICATION_FACTOR,
    configEntries: [
      { name: 'retention.ms', value: String(retention * 24 * 60 * 60 * 1000) },
    ],
  }));

  await admin.createTopics({ topics, waitForLeaders: true });

  console.log('Topics created:');
  topics.forEach(t => console.log(`  ✓ ${t.topic}`));

  await admin.disconnect();
  console.log(`\nDone. ${topics.length} topics provisioned for customer ${customerId}.`);
}

run().catch((err) => {
  console.error('Topic provisioning failed:', err.message);
  process.exit(1);
});
