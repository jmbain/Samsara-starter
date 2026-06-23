import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { VehicleMapService } from '../../vehicle-map/vehicle-map.service';
import { LoggerService } from '../../logger/logger.service';

/**
 * Handles messages from samsara.{customerId}.route-events
 *
 * Subtypes handled: RouteStopArrival, RouteStopDeparture
 *
 * On RouteStopDeparture: extract liveSharingUrl from routeStopDetails and upsert
 * into live_sharing_links (source=kafka, link_type=routeStopLink).
 *
 * NOTE: liveSharingUrl is only present for customers using Samsara's Dispatch/Routing
 * module. Non-routing customers will have a missing URL — this is expected and logged
 * as a warning, not an error.
 *
 * IMPORTANT: The field is `routeStopDetails.liveSharingUrl` (string URL), NOT
 * expiresAtMs. Do not confuse with the REST API field expiresAtTime.
 */
@Injectable()
export class RouteEventsHandler {
  constructor(
    private readonly db: DatabaseService,
    private readonly vehicleMap: VehicleMapService,
    private readonly logger: LoggerService,
  ) {}

  async handle(payload: any, customerId: string, topic?: string): Promise<void> {
    const eventType: string | undefined = payload?.eventType;
    if (!['RouteStopArrival', 'RouteStopDeparture'].includes(eventType ?? '')) {
      this.logger.debug(`Ignoring non-route-stop event type: ${eventType}`, RouteEventsHandler.name);
      return;
    }

    const samsaraAssetId: string | undefined = payload?.asset?.id;
    const busieVehicleId = samsaraAssetId
      ? await this.vehicleMap.lookupBusieVehicleId(customerId, samsaraAssetId)
      : null;

    const routeStop = payload?.routeStopDetails;

    // TODO: upsert into route_stop_actuals table
    this.logger.info(
      {
        customerId,
        busieVehicleId,
        eventType,
        stopId: routeStop?.id,
        arrivedAt: routeStop?.actualArrivalTime,
        departedAt: routeStop?.actualDepartureTime,
      },
      'Route stop event recorded',
      RouteEventsHandler.name,
    );

    // Extract live sharing link on departure
    if (eventType === 'RouteStopDeparture') {
      const linkUrl: string | undefined = routeStop?.liveSharingUrl;
      if (linkUrl) {
        await this.db.upsertLiveSharingLink({
          customerId,
          busieVehicleId: busieVehicleId ?? '',
          samsaraAssetId: samsaraAssetId ?? '',
          samsaraRouteStopId: routeStop?.id ?? null,
          linkUrl,
          linkType: 'routeStopLink',
          source: 'kafka',
        });
        this.logger.info(
          { customerId, busieVehicleId, stopId: routeStop?.id },
          'Live sharing link stored from Kafka route event',
          RouteEventsHandler.name,
        );
      } else {
        // Expected for non-routing customers
        this.logger.warnMeta(
          { customerId, topic },
          'RouteStopDeparture missing liveSharingUrl — customer may not use Samsara routing',
          RouteEventsHandler.name,
        );
        // TODO: flag customer as non-routing in samsara_customers
      }
    }
  }
}
