import { Global, Module } from '@nestjs/common';
import { SchemaRegistryService } from './schema-registry.service';

/**
 * Provides SchemaRegistryService globally so it can be injected into
 * KafkaService without requiring explicit imports in every consuming module.
 */
@Global()
@Module({
  providers: [SchemaRegistryService],
  exports: [SchemaRegistryService],
})
export class SchemaRegistryModule {}
