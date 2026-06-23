import { Injectable } from '@nestjs/common';
import { VehicleMapService } from '../../vehicle-map/vehicle-map.service';
import { LoggerService } from '../../logger/logger.service';

/**
 * Handles messages from samsara.{customerId}.vehicle-events
 *
 * Subtypes: VehicleCreated, VehicleUpdated, VehicleDeleted (soft)
 */
@Injectable()
export class VehicleEventsHandler {
  constructor(
    private readonly vehicleMap: VehicleMapService,
    private readonly logger: LoggerService,
  ) {}

  async handle(payload: any, customerId: string): Promise<void> {
    const eventType: string | undefined = payload?.eventType;
    const vehicle = payload?.vehicle;

    if (!vehicle?.id) {
      this.logger.warnMeta(
        { customerId, eventType },
        'Vehicle event missing vehicle.id — skipping',
        VehicleEventsHandler.name,
      );
      return;
    }

    // TODO:
    // - VehicleCreated:  upsert samsara_vehicle_map; alert if VIN clash with existing mapping
    // - VehicleUpdated:  update samsara_vehicle_map metadata (name, VIN, plate)
    //                    call vehicleMap.invalidate() to flush cache
    // - VehicleDeleted:  soft-delete (set deleted_at) — never hard-delete to preserve audit trail

    this.logger.info(
      { customerId, eventType, samsaraAssetId: vehicle.id, vin: vehicle.vin },
      'Vehicle event processed',
      VehicleEventsHandler.name,
    );
  }
}
