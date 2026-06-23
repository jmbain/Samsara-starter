import {
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Consumer, logLevel } from 'kafkajs';
import { ConsumerService } from '../consumer/consumer.service';
import { LoggerService } from '../logger/logger.service';

/**
 * Manages the Kafka consumer lifecycle within the NestJS application.
 *
 * NOTE: This module uses kafkajs as a temporary implementation for Phase 1.
 * It will be replaced with @confluentinc/kafka-javascript in Phase 3, which:
 *   - Uses Confluent's native librdkafka client (org standard, matches RMS)
 *   - Requires switching from regex topic subscription to explicit topic enumeration
 *     (Confluent client does not support regex patterns)
 *   - Changes the consumer API from async iterator to poll-based callback style
 *
 * TODO (Phase 3): Replace kafkajs with @confluentinc/kafka-javascript
 * TODO (Phase 3): Implement startupTopicDiscovery() to enumerate samsara.* topics
 *                 from cluster metadata rather than relying on regex subscription
 */
@Injectable()
export class KafkaService implements OnApplicationBootstrap, OnApplicationShutdown {
  private consumer: Consumer;
  private lastMessageAt: Date | null = null;
  private livenessTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly consumerService: ConsumerService,
    private readonly logger: LoggerService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const bootstrapServers = this.configService.get<string>('kafka.bootstrapServers');
    const saslUsername = this.configService.get<string>('kafka.saslUsername');
    const saslPassword = this.configService.get<string>('kafka.saslPassword');
    const ssl = this.configService.get<boolean>('kafka.ssl') ?? true;
    const groupId = this.configService.get<string>('kafka.consumerGroupId') ?? 'samsara-consumer-dev';

    if (!bootstrapServers || !saslUsername || !saslPassword) {
      this.logger.warn(
        'Kafka credentials not configured — consumer will not start. Set KAFKA_BOOTSTRAP_SERVERS, KAFKA_SASL_USERNAME, KAFKA_SASL_PASSWORD.',
        KafkaService.name,
      );
      return;
    }

    const kafka = new Kafka({
      clientId: 'busie-samsara-consumer',
      brokers: bootstrapServers.split(','),
      ssl,
      sasl: { mechanism: 'plain', username: saslUsername, password: saslPassword },
      logLevel: logLevel.WARN,
    });

    this.consumer = kafka.consumer({ groupId });
    await this.consumer.connect();
    this.logger.log('Kafka consumer connected', KafkaService.name);

    // Subscribe to all samsara.* topics via regex pattern (kafkajs supports this)
    // NOTE: Phase 3 replaces this with explicit topic enumeration via cluster metadata
    await this.consumer.subscribe({ topics: /^samsara\..*/, fromBeginning: false });

    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        this.lastMessageAt = new Date();

        let payload: unknown;
        try {
          // Phase 1: raw JSON parse. Phase 4 replaces with Schema Registry deserialization.
          payload = JSON.parse(message.value?.toString() ?? 'null');
        } catch {
          this.logger.errorMeta(
            { topic, partition, offset: message.offset },
            'Failed to parse message — routing to DLQ',
            KafkaService.name,
          );
          // TODO (Phase 3+): produce to samsara.{customerId}.dlq
          return;
        }

        try {
          await this.consumerService.route(topic, payload);
        } catch (err) {
          this.logger.errorMeta(
            { topic, partition, offset: message.offset, err },
            'Handler error — routing to DLQ',
            KafkaService.name,
          );
          // TODO (Phase 3+): produce to samsara.{customerId}.dlq
        }
      },
    });

    this.startLivenessMonitor();
    this.logger.log('Kafka consumer running', KafkaService.name);
  }

  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(`Shutting down Kafka consumer (signal: ${signal ?? 'none'})`, KafkaService.name);
    if (this.livenessTimer) clearInterval(this.livenessTimer);
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
   * Logs a warning when no messages have been received for an extended period.
   * The kafkajs idle-disconnect bug (#1725) silently stops consumption after ~10 min;
   * this monitor surfaces that condition. Phase 3 (Confluent client) eliminates the bug.
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
          'Kafka consumer has been idle — possible silent disconnect (kafkajs bug #1725). Restart if no messages expected.',
          KafkaService.name,
        );
      }
    }, CHECK_INTERVAL_MS);
  }
}
