import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { LoggerModule } from './logger/logger.module';
import { DatabaseModule } from './database/database.module';
import { SecretsModule } from './secrets/secrets.module';
import { VehicleMapModule } from './vehicle-map/vehicle-map.module';
import { ConsumerModule } from './consumer/consumer.module';
import { KafkaModule } from './kafka/kafka.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { LiveShareModule } from './live-share/live-share.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    LoggerModule,
    DatabaseModule,
    SecretsModule,
    VehicleMapModule,
    ConsumerModule,
    KafkaModule,
    OnboardingModule,
    LiveShareModule,
    HealthModule,
  ],
})
export class AppModule {}
