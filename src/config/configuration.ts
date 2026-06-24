export default () => ({
  port: parseInt(process.env.HTTP_PORT ?? process.env.PORT ?? '3000', 10),

  kafka: {
    bootstrapServers: process.env.KAFKA_BOOTSTRAP_SERVERS,
    saslUsername: process.env.KAFKA_SASL_USERNAME,
    saslPassword: process.env.KAFKA_SASL_PASSWORD,
    ssl: (process.env.KAFKA_SSL ?? 'true') === 'true',
    consumerGroupId: process.env.KAFKA_CONSUMER_GROUP_ID ?? 'samsara-consumer-dev',
    consumerGroupPrefix: process.env.KAFKA_CONSUMER_GROUP_PREFIX ?? 'samsara-consumer-',
  },

  schemaRegistry: {
    host: process.env.KAFKA_SCHEMA_REGISTRY_HOST,
    username: process.env.KAFKA_SCHEMA_REGISTRY_USERNAME,
    password: process.env.KAFKA_SCHEMA_REGISTRY_PASSWORD,
  },

  samsara: {
    baseUrl: process.env.SAMSARA_API_BASE_URL ?? 'https://api.samsara.com',
    // Dev shortcut: set SAMSARA_API_TOKEN to bypass Secrets Manager for local dev
    devApiToken: process.env.SAMSARA_API_TOKEN,
  },

  db: {
    connectionString: process.env.DATABASE_URL,
  },

  aws: {
    region: process.env.AWS_REGION ?? 'us-east-1',
  },

  app: {
    env: process.env.NODE_ENV ?? 'development',
    logLevel: process.env.LOG_LEVEL ?? 'info',
    useSimple: (process.env.USE_SIMPLE ?? 'true') === 'true',
  },
});
