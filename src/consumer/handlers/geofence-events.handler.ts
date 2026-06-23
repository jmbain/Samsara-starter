import { Injectable } from '@nestjs/common';
import { VehicleMapService } from '../../vehicle-map/vehicle-map.service';
import { LoggerService } from '../../logger/logger.service';

/**
 * Handles messages from samsara.{customerId}.geofence-events
 *
 * Priority 1 entity. Foundational for:
 *   - Automatic status triggers (e.g. "arrived at depot" → trip status update)
 *   - Live driver map geofence overlays
 *
 * Expected payload shape:
 * {
 *   happenedAtTime: "2024-01-15T10:30:00Z",
 *   asset: { id: "samsara-asset-id" },
 *   geofence: { id: "geofence-id", name: "..." },
 *   eventType: "GeofenceEntry" | "GeofenceExit"
 * }
 *
 * NOTE: geofence.name is not guaranteed in this event. A one-time REST sync of
 * GET /fleet/geofences populates a geofence_metadata lookup table. That sync
 * is a deferred task (see implementation plan Appendix A).
 */
@Injectable()
export class GeofenceEventsHandler {
  constructor(
    private readonly vehicleMap: VehicleMapService,
    private readonly logger: LoggerService,
  ) {}

  async handle(payload: any, customerId: string): Promise<void> {
    const samsaraAssetId: string | undefined = payload?.asset?.id;
    const geofenceId: string | undefined = payload?.geofence?.id;
    const eventType: string | undefined = payload?.eventType;

    if (!samsaraAssetId || !geofenceId || !eventType) {
      this.logger.warnMeta(
        { customerId, samsaraAssetId, geofenceId, eventType },
        'Geofence event missing required fields — skipping',
        GeofenceEventsHandler.name,
      );
      return;
    }

    const busieVehicleId = await this.vehicleMap.lookupBusieVehicleId(customerId, samsaraAssetId);
    if (!busieVehicleId) return;

    // TODO: upsert into geofence_events table
    // TODO: trigger status automation logic based on geofenceId + eventType
    this.logger.info(
      { customerId, busieVehicleId, geofenceId, eventType, happenedAt: payload.happenedAtTime },
      'Geofence event recorded',
      GeofenceEventsHandler.name,
    );
  }
}
