import { Injectable } from '@nestjs/common';
import { LoggerService } from '../../logger/logger.service';

/**
 * Handles messages from samsara.{customerId}.driver-events
 *
 * Subtypes: DriverCreated, DriverUpdated, DriverDeleted (soft)
 */
@Injectable()
export class DriverEventsHandler {
  constructor(private readonly logger: LoggerService) {}

  async handle(payload: any, customerId: string): Promise<void> {
    const eventType: string | undefined = payload?.eventType;
    const driver = payload?.driver;

    if (!driver?.id) {
      this.logger.warnMeta(
        { customerId, eventType },
        'Driver event missing driver.id — skipping',
        DriverEventsHandler.name,
      );
      return;
    }

    // TODO:
    // - DriverCreated/Updated: upsert into drivers table
    // - DriverDeleted: soft-delete (set deleted_at)

    this.logger.info(
      { customerId, eventType, driverId: driver.id, name: driver.name },
      'Driver event processed',
      DriverEventsHandler.name,
    );
  }
}
