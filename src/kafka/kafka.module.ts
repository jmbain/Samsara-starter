import { Module } from '@nestjs/common';
import { KafkaService } from './kafka.service';
import { ConsumerModule } from '../consumer/consumer.module';

@Module({
  imports: [ConsumerModule],
  providers: [KafkaService],
  exports: [KafkaService],
})
export class KafkaModule {}
