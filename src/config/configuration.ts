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

  confluent: {
    // Cloud-scoped API key — used for all management calls to api.confluent.cloud
    // Obtain from: Confluent Cloud Console → API Keys → Cloud resource type
    cloudApiKey: process.env.CONFLUENT_CLOUD_KEY ?? 'PLACEHOLDER_KEY',
    cloudApiSecret: process.env.CONFLUENT_CLOUD_SECRET ?? 'PLACEHOLDER_SECRET',

    // Organisation and environment IDs — visible in Confluent Cloud Console URLs
    orgId: process.env.CONFLUENT_ORG_ID ?? '',
    envId: process.env.CONFLUENT_ENV_ID ?? '',

    // Set these after the first cluster creation so subsequent calls skip provisioning.
    // Leave blank to trigger cluster creation on the first connect request.
    clusterId: process.env.CONFLUENT_CLUSTER_ID ?? '',
    clusterRestEndpoint: process.env.CONFLUENT_CLUSTER_REST_ENDPOINT ?? '',

    // The shared Busie consumer service account ID (sa-xxxxx).
    // This SA receives DeveloperRead bindings for each new customer's topic prefix.
    consumerSaId: process.env.CONFLUENT_CONSUMER_SA_ID ?? '',
  },

  app: {
    env: process.env.NODE_ENV ?? 'development',
    logLevel: process.env.LOG_LEVEL ?? 'info',
    useSimple: (process.env.USE_SIMPLE ?? 'true') === 'true',
  },
});
