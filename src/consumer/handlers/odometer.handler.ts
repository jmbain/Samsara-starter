import { Injectable } from '@nestjs/common';
import { VehicleMapService } from '../../vehicle-map/vehicle-map.service';
import { LoggerService } from '../../logger/logger.service';

/**
 * Handles messages from:
 *   samsara.{customerId}.odometer-obd
 *   samsara.{customerId}.odometer-gps
 *
 * Expected payload shape:
 * {
 *   happenedAtTime: "2024-01-15T10:30:00Z",
 *   asset: { id: "samsara-asset-id" },
 *   obdOdometerMeters: { value: 123456 }   // odometer-obd topic
 *   // OR
 *   gpsOdometerMeters: { value: 123400 }   // odometer-gps topic
 * }
 */
@Injectable()
export class OdometerHandler {
  constructor(
    private readonly vehicleMap: VehicleMapService,
    private readonly logger: LoggerService,
  ) {}

  async handle(payload: any, customerId: string, topic: string): Promise<void> {
    const samsaraAssetId: string | undefined = payload?.asset?.id;
    if (!samsaraAssetId) {
      this.logger.warnMeta({ customerId }, 'Odometer message missing asset.id — skipping', OdometerHandler.name);
      return;
    }

    const busieVehicleId = await this.vehicleMap.lookupBusieVehicleId(customerId, samsaraAssetId);
    if (!busieVehicleId) return;

    const isObd = topic.endsWith('odometer-obd');
    const valueMeters: number | undefined = isObd
      ? payload.obdOdometerMeters?.value
      : payload.gpsOdometerMeters?.value;

    // TODO: upsert into vehicle_odometer table, storing both obd and gps columns
    this.logger.info(
      { customerId, busieVehicleId, isObd, valueMeters, recordedAt: payload.happenedAtTime },
      'Odometer recorded',
      OdometerHandler.name,
    );
  }
}
