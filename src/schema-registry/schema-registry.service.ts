import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SchemaRegistryClient,
  AvroDeserializer,
  SerdeType,
} from '@confluentinc/schemaregistry';
import { LoggerService } from '../logger/logger.service';

/**
 * Wraps the Confluent Schema Registry client for Avro deserialization.
 *
 * Samsara's Kafka connector serializes all message values as Avro against
 * the shared Confluent Schema Registry. This service handles deserialization
 * before messages reach the consumer handlers, so handlers always receive
 * plain JS objects rather than raw Buffers.
 *
 * Schema lookups are cached internally by the SchemaRegistryClient — no
 * additional caching layer is needed here.
 */
@Injectable()
export class SchemaRegistryService {
  private readonly deserializer: AvroDeserializer;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    const host = this.configService.get<string>('schemaRegistry.host') ?? '';
    const username = this.configService.get<string>('schemaRegistry.username') ?? '';
    const password = this.configService.get<string>('schemaRegistry.password') ?? '';

    const client = new SchemaRegistryClient({
      baseURLs: [host],
      basicAuthCredentials: {
        credentialsSource: 'USER_INFO',
        userInfo: `${username}:${password}`,
      },
    });

    this.deserializer = new AvroDeserializer(client, SerdeType.VALUE, {});
  }

  /**
   * Deserializes an Avro-encoded Kafka message value using the Schema Registry.
   *
   * Returns a plain JS object on success. On failure, logs the error and
   * returns null — the caller (KafkaService) should treat null as a parse
   * failure and skip routing.
   */
  async deserialize(topicName: string, rawValue: Buffer): Promise<unknown> {
    try {
      return await this.deserializer.deserialize(topicName, rawValue);
    } catch (err) {
      this.logger.errorMeta(
        { topicName, err },
        'Schema Registry deserialization failed',
        SchemaRegistryService.name,
      );
      return null;
    }
  }
}
