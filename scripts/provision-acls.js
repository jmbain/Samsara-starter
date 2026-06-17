#!/usr/bin/env node
/**
 * provision-acls.js
 * Creates Kafka ACLs in Confluent Cloud for a new Samsara customer.
 *
 * Prerequisites (manual steps in Confluent Cloud Console or CLI before running):
 *   1. Create service account "samsara-producer"  → note its numeric ID (e.g. sa-abc123)
 *   2. Create service account "busie-consumer"    → note its numeric ID (e.g. sa-xyz789)
 *   3. Generate an API key/secret pair for samsara-producer → hand these to Samsara Dashboard
 *   4. Generate an API key/secret pair for busie-consumer   → put in .env for the consumer process
 *
 * Usage:
 *   node scripts/provision-acls.js \
 *     --customer-id <busie_customer_id> \
 *     --producer-principal User:<samsara-producer-sa-id> \
 *     --consumer-principal User:<busie-consumer-sa-id>
 *
 * Example:
 *   node scripts/provision-acls.js \
 *     --customer-id cust_001 \
 *     --producer-principal "User:sa-abc123" \
 *     --consumer-principal "User:sa-xyz789"
 *
 * Requires KAFKA_BOOTSTRAP_SERVERS, KAFKA_API_KEY, KAFKA_API_SECRET in env (or .env).
 * The credentials used here must belong to a cluster-admin service account.
 */
'use strict';
require('dotenv').config();
const { Kafka, AclResourceTypes, AclOperationTypes, AclPermissionTypes, ResourcePatternTypes } = require('kafkajs');
const config = require('../src/config');

// --- Parse CLI args ---
const args = process.argv.slice(2);
const get = (flag) => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : null;
};

const customerId        = get('--customer-id');
const producerPrincipal = get('--producer-principal');
const consumerPrincipal = get('--consumer-principal');

if (!customerId || !producerPrincipal || !consumerPrincipal) {
  console.error(
    'Usage: node scripts/provision-acls.js \\\n' +
    '  --customer-id <id> \\\n' +
    '  --producer-principal "User:<sa-id>" \\\n' +
    '  --consumer-principal "User:<sa-id>"'
  );
  process.exit(1);
}

// Topic prefix and consumer group prefix for this customer
const TOPIC_PREFIX = `samsara.${customerId}.`;
const GROUP_PREFIX  = `${config.kafka.consumerGroupPrefix}${customerId}.`;

async function run() {
  const kafka = new Kafka({
    clientId: 'busie-acl-provisioner',
    brokers: config.kafka.brokers,
    ssl: config.kafka.ssl,
    sasl: config.kafka.sasl,
  });

  const admin = kafka.admin();
  await admin.connect();
  console.log(`Connected. Provisioning ACLs for customer: ${customerId}`);

  const acls = [
    // ── samsara-producer: WRITE + DESCRIBE on samsara.<customerId>.* topics ──
    // Samsara needs WRITE to produce events and DESCRIBE to check partition metadata.
    {
      resourceType: AclResourceTypes.TOPIC,
      resourceName: TOPIC_PREFIX,
      resourcePatternType: ResourcePatternTypes.PREFIXED,
      principal: producerPrincipal,
      host: '*',
      operation: AclOperationTypes.WRITE,
      permissionType: AclPermissionTypes.ALLOW,
    },
    {
      resourceType: AclResourceTypes.TOPIC,
      resourceName: TOPIC_PREFIX,
      resourcePatternType: ResourcePatternTypes.PREFIXED,
      principal: producerPrincipal,
      host: '*',
      operation: AclOperationTypes.DESCRIBE,
      permissionType: AclPermissionTypes.ALLOW,
    },

    // ── busie-consumer: READ + DESCRIBE on samsara.<customerId>.* topics ──
    {
      resourceType: AclResourceTypes.TOPIC,
      resourceName: TOPIC_PREFIX,
      resourcePatternType: ResourcePatternTypes.PREFIXED,
      principal: consumerPrincipal,
      host: '*',
      operation: AclOperationTypes.READ,
      permissionType: AclPermissionTypes.ALLOW,
    },
    {
      resourceType: AclResourceTypes.TOPIC,
      resourceName: TOPIC_PREFIX,
      resourcePatternType: ResourcePatternTypes.PREFIXED,
      principal: consumerPrincipal,
      host: '*',
      operation: AclOperationTypes.DESCRIBE,
      permissionType: AclPermissionTypes.ALLOW,
    },

    // ── busie-consumer: READ + DESCRIBE on consumer group samsara-consumer-<customerId>.* ──
    {
      resourceType: AclResourceTypes.GROUP,
      resourceName: GROUP_PREFIX,
      resourcePatternType: ResourcePatternTypes.PREFIXED,
      principal: consumerPrincipal,
      host: '*',
      operation: AclOperationTypes.READ,
      permissionType: AclPermissionTypes.ALLOW,
    },
    {
      resourceType: AclResourceTypes.GROUP,
      resourceName: GROUP_PREFIX,
      resourcePatternType: ResourcePatternTypes.PREFIXED,
      principal: consumerPrincipal,
      host: '*',
      operation: AclOperationTypes.DESCRIBE,
      permissionType: AclPermissionTypes.ALLOW,
    },
  ];

  await admin.createAcls({ acl: acls });

  console.log('\nACLs created:');
  console.log(`  [samsara-producer] ${producerPrincipal}`);
  console.log(`    ✓ TOPIC  WRITE   ${TOPIC_PREFIX}* (PREFIXED)`);
  console.log(`    ✓ TOPIC  DESCRIBE ${TOPIC_PREFIX}* (PREFIXED)`);
  console.log(`  [busie-consumer]  ${consumerPrincipal}`);
  console.log(`    ✓ TOPIC  READ    ${TOPIC_PREFIX}* (PREFIXED)`);
  console.log(`    ✓ TOPIC  DESCRIBE ${TOPIC_PREFIX}* (PREFIXED)`);
  console.log(`    ✓ GROUP  READ    ${GROUP_PREFIX}* (PREFIXED)`);
  console.log(`    ✓ GROUP  DESCRIBE ${GROUP_PREFIX}* (PREFIXED)`);

  console.log('\nNext steps:');
  console.log('  1. In Samsara Dashboard → Settings → Kafka Connector:');
  console.log(`     Bootstrap servers : ${config.kafka.brokers.join(',')}`);
  console.log(`     API Key           : <samsara-producer API key generated in Confluent Console>`);
  console.log(`     API Secret        : <samsara-producer API secret>`);
  console.log(`     Topic prefix      : samsara.${customerId}`);
  console.log('  2. Add busie-consumer API key/secret to your .env as KAFKA_API_KEY / KAFKA_API_SECRET');
  console.log('  3. Run the consumer to verify events are flowing:');
  console.log('     node src/consumer/index.js');

  await admin.disconnect();
  console.log('\nDone.');
}

run().catch((err) => {
  console.error('ACL provisioning failed:', err.message);
  process.exit(1);
});
