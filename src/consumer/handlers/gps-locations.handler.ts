import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { VehicleMapService } from '../../vehicle-map/vehicle-map.service';
import { LoggerService } from '../../logger/logger.service';

/**
 * Handles messages from samsara.{customerId}.gps-locations
 *
 * Expected payload shape (Samsara GPS Locations entity):
 * {
 *   happenedAtTime: "2024-01-15T10:30:00Z",
 *   asset: { id: "samsara-asset-id" },
 *   location: {
 *     latitude: 37.7749,
 *     longitude: -122.4194,
 *     headingDegrees: 180,
 *     address: { formattedAddress: "..." },
 *     geofence: { id: "..." }   // optional
 *   },
 *   speed: {
 *     gpsSpeedMetersPerSecond: 13.4,
 *     ecuSpeedMetersPerSecond: 13.2
 *   }
 * }
 */
@Injectable()
export class GpsLocationsHandler {
  constructor(
    private readonly db: DatabaseService,
    private readonly vehicleMap: VehicleMapService,
    private readonly logger: LoggerService,
  ) {}

  async handle(payload: any, customerId: string): Promise<void> {
    const samsaraAssetId: string | undefined = payload?.asset?.id;
    if (!samsaraAssetId) {
      this.logger.warnMeta({ customerId }, 'GPS message missing asset.id — skipping', GpsLocationsHandler.name);
      return;
    }

    const busieVehicleId = await this.vehicleMap.lookupBusieVehicleId(customerId, samsaraAssetId);
    if (!busieVehicleId) {
      // warnMeta already logged by VehicleMapService
      // TODO: emit alert to admin review queue
      return;
    }

    await this.db.upsertVehicleLocation({
      customerId,
      busieVehicleId,
      samsaraAssetId,
      recordedAt: payload.happenedAtTime,
      lat: payload.location?.latitude,
      lng: payload.location?.longitude,
      headingDegrees: payload.location?.headingDegrees,
      gpsSpeedMs: payload.speed?.gpsSpeedMetersPerSecond,
      ecuSpeedMs: payload.speed?.ecuSpeedMetersPerSecond,
      addressJson: payload.location?.address ?? null,
      geofenceId: payload.location?.geofence?.id ?? null,
    });

    this.logger.info(
      { customerId, busieVehicleId, recordedAt: payload.happenedAtTime },
      'GPS location recorded',
      GpsLocationsHandler.name,
    );
  }
}
