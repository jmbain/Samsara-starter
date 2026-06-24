import {
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KafkaJS } from '@confluentinc/kafka-javascript';
import { ConsumerService } from '../consumer/consumer.service';
import { LoggerService } from '../logger/logger.service';
import { SchemaRegistryService } from '../schema-registry/schema-registry.service';

/**
 * Manages the Kafka consumer lifecycle within the NestJS application.
 *
 * Uses the KafkaJS compatibility layer from @confluentinc/kafka-javascript,
 * which provides the same async/await API as kafkajs but backed by librdkafka.
 * This is the org standard (matches RMS).
 *
 * Key difference from kafkajs: the Confluent client does NOT support regex topic
 * subscription. startupTopicDiscovery() uses the Admin API at boot to enumerate
 * all samsara.* topics from cluster metadata and subscribes explicitly.
 */
@Injectable()
export class KafkaService implements OnApplicationBootstrap, OnApplicationShutdown {
  private consumer: KafkaJS.Consumer | null = null;
  private admin: KafkaJS.Admin | null = null;
  private lastMessageAt: Date | null = null;
  private livenessTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly consumerService: ConsumerService,
    private readonly logger: LoggerService,
    private readonly schemaRegistry: SchemaRegistryService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const bootstrapServers = this.configService.get<string>('kafka.bootstrapServers');
    const saslUsername = this.configService.get<string>('kafka.saslUsername');
    const saslPassword = this.configService.get<string>('kafka.saslPassword');
    const ssl = this.configService.get<boolean>('kafka.ssl') ?? true;
    const groupId =
      this.configService.get<string>('kafka.consumerGroupId') ?? 'samsara-consumer-dev';

    if (!bootstrapServers || !saslUsername || !saslPassword) {
      this.logger.warn(
        'Kafka credentials not configured — consumer will not start. Set KAFKA_BOOTSTRAP_SERVERS, KAFKA_SASL_USERNAME, KAFKA_SASL_PASSWORD.',
        KafkaService.name,
      );
      return;
    }

    const sasl: KafkaJS.SASLOptions | undefined = ssl
      ? { mechanism: 'plain', username: saslUsername, password: saslPassword }
      : undefined;

    const kafka = new KafkaJS.Kafka({
      kafkaJS: {
        brokers: bootstrapServers.split(','),
        ssl,
        sasl,
        clientId: groupId,
      },
    });

    // Discover all samsara.* topics from cluster metadata before subscribing.
    // The Confluent client does not support regex subscription patterns, so we
    // enumerate topics explicitly at startup. New customers added after service
    // start require a redeploy (or a future hot-reload implementation).
    const samsaraTopics = await this.startupTopicDiscovery(kafka);

    if (samsaraTopics.length === 0) {
      this.logger.warn(
        'No samsara.* topics found in cluster metadata — consumer will not subscribe. ' +
          'Ensure topics have been provisioned via Terraform before starting.',
        KafkaService.name,
      );
    }

    this.consumer = kafka.consumer({ kafkaJS: { groupId } });
    await this.consumer.connect();
    this.logger.log('Kafka consumer connected', KafkaService.name);

    for (const topic of samsaraTopics) {
      await this.consumer.subscribe({ topic });
    }

    this.logger.log(
      `Kafka consumer subscribed to ${samsaraTopics.length} topics`,
      KafkaService.name,
    );

    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }: KafkaJS.EachMessagePayload) => {
        this.lastMessageAt = new Date();

        if (!message.value) {
          this.logger.warnMeta(
            { topic, partition, offset: message.offset },
            'Received message with null value — skipping',
            KafkaService.name,
          );
          return;
        }

        // Deserialize Avro payload via Schema Registry before routing.
        // SchemaRegistryService handles schema lookup, caching, and error logging.
        // A null return means deserialization failed — skip routing.
        const payload = await this.schemaRegistry.deserialize(topic, message.value);
        if (payload === null) {
          return;
        }

        try {
          await this.consumerService.route(topic, payload);
        } catch (err) {
          this.logger.errorMeta(
            { topic, partition, offset: message.offset, err },
            'Handler threw an error',
            KafkaService.name,
          );
        }
      },
    });

    this.startLivenessMonitor();
    this.logger.log('Kafka consumer running', KafkaService.name);
  }

  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(`Shutting down Kafka consumer (signal: ${signal ?? 'none'})`, KafkaService.name);
    if (this.livenessTimer) clearInterval(this.livenessTimer);
    if (this.admin) {
      await this.admin.disconnect();
    }
    if (this.consumer) {
      await this.consumer.disconnect();
      this.logger.log('Kafka consumer disconnected', KafkaService.name);
    }
  }

  /** Returns when the consumer last received a message — used by /health endpoint */
  getLastMessageAt(): Date | null {
    return this.lastMessageAt;
  }

  /**
   * Uses the Admin API to list all topics in the cluster and return those
   * matching the samsara.* pattern. Called once at application bootstrap.
   *
   * The Confluent client (unlike kafkajs) does not support regex subscription,
   * so explicit topic enumeration is required.
   */
  private async startupTopicDiscovery(kafka: KafkaJS.Kafka): Promise<string[]> {
    this.admin = kafka.admin();
    await this.admin.connect();

    let allTopics: string[] = [];
    try {
      allTopics = await this.admin.listTopics();
    } catch (err) {
      this.logger.errorMeta(
        { err },
        'Failed to list topics from cluster metadata — proceeding with empty topic list',
        KafkaService.name,
      );
    }

    const samsaraTopics = allTopics.filter((t) => /^samsara\./.test(t));

    this.logger.log(
      `Topic discovery complete: ${samsaraTopics.length} samsara.* topics found`,
      KafkaService.name,
    );

    return samsaraTopics;
  }

  /**
   * Monitors consumer liveness and logs a warning when no messages have been
   * received for an extended period. Useful for surfacing stalled consumers
   * or misconfigured topic subscriptions.
   */
  private startLivenessMonitor(): void {
    const WARN_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
    const CHECK_INTERVAL_MS = 5 * 60 * 1000;  // check every 5 minutes

    this.livenessTimer = setInterval(() => {
      if (!this.lastMessageAt) return;
      const idleMs = Date.now() - this.lastMessageAt.getTime();
      if (idleMs > WARN_THRESHOLD_MS) {
        this.logger.warnMeta(
          { idleMinutes: Math.round(idleMs / 60000) },
          'Kafka consumer has been idle — verify topic subscription and cluster connectivity.',
          KafkaService.name,
        );
      }
    }, CHECK_INTERVAL_MS);
  }
}
