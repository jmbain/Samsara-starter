'use strict';
require('dotenv').config();

function required(name) {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required environment variable: ${name}`);
  return val;
}

module.exports = {
  kafka: {
    brokers: required('KAFKA_BOOTSTRAP_SERVERS').split(','),
    sasl: {
      mechanism: 'plain',
      username: required('KAFKA_API_KEY'),
      password: required('KAFKA_API_SECRET'),
    },
    ssl: true,
    consumerGroupPrefix: process.env.KAFKA_CONSUMER_GROUP_PREFIX || 'samsara-consumer',
  },

  db: {
    connectionString: required('DATABASE_URL'),
  },

  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
  },

  samsara: {
    baseUrl: 'https://api.samsara.com',
    // Per-customer tokens are fetched from Secrets Manager at runtime.
    // Only set for local single-customer dev.
    devApiToken: process.env.SAMSARA_API_TOKEN,
  },

  app: {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    logLevel: process.env.LOG_LEVEL || 'info',
  },
};
