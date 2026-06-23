import { Injectable } from '@nestjs/common';
import { LoggerService } from '../../logger/logger.service';

/**
 * Handles messages from samsara.{customerId}.driver-vehicle-roster
 *
 * Priority 1 entity. Tracks which driver is assigned to which vehicle at any
 * given time. Essential for attributing HOS data and GPS tracks to drivers.
 *
 * Expected payload shape:
 * {
 *   happenedAtTime: "2024-01-15T10:30:00Z",
 *   asset: { id: "samsara-vehicle-id" },
 *   driver: { id: "samsara-driver-id", name: "..." },
 *   eventType: "DriverVehicleAssigned" | "DriverVehicleUnassigned"
 * }
 */
@Injectable()
export class DriverVehicleRosterHandler {
  constructor(private readonly logger: LoggerService) {}

  async handle(payload: any, customerId: string): Promise<void> {
    const samsaraAssetId: string | undefined = payload?.asset?.id;
    const driverId: string | undefined = payload?.driver?.id;
    const eventType: string | undefined = payload?.eventType;

    if (!samsaraAssetId || !driverId) {
      this.logger.warnMeta(
        { customerId, eventType },
        'Driver-vehicle roster event missing asset.id or driver.id — skipping',
        DriverVehicleRosterHandler.name,
      );
      return;
    }

    // TODO: upsert into driver_vehicle_assignments table
    this.logger.info(
      { customerId, samsaraAssetId, driverId, eventType, happenedAt: payload.happenedAtTime },
      'Driver-vehicle roster event processed',
      DriverVehicleRosterHandler.name,
    );
  }
}
