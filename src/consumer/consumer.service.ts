import { Injectable } from '@nestjs/common';
import { LoggerService } from '../logger/logger.service';
import { GpsLocationsHandler } from './handlers/gps-locations.handler';
import { EngineStatesHandler } from './handlers/engine-states.handler';
import { OdometerHandler } from './handlers/odometer.handler';
import { GeofenceEventsHandler } from './handlers/geofence-events.handler';
import { RouteEventsHandler } from './handlers/route-events.handler';
import { VehicleEventsHandler } from './handlers/vehicle-events.handler';
import { DriverEventsHandler } from './handlers/driver-events.handler';
import { DriverVehicleRosterHandler } from './handlers/driver-vehicle-roster.handler';
import { DriverHosLogsHandler } from './handlers/driver-hos-logs.handler';

/**
 * Routes incoming Kafka messages to the correct handler based on the entity slug
 * extracted from the topic name: samsara.{customerId}.{entity-slug}
 */
@Injectable()
export class ConsumerService {
  constructor(
    private readonly logger: LoggerService,
    private readonly gpsLocations: GpsLocationsHandler,
    private readonly engineStates: EngineStatesHandler,
    private readonly odometer: OdometerHandler,
    private readonly geofenceEvents: GeofenceEventsHandler,
    private readonly routeEvents: RouteEventsHandler,
    private readonly vehicleEvents: VehicleEventsHandler,
    private readonly driverEvents: DriverEventsHandler,
    private readonly driverVehicleRoster: DriverVehicleRosterHandler,
    private readonly driverHosLogs: DriverHosLogsHandler,
  ) {}

  /**
   * Route a message to its handler.
   * @param topic   Full topic name, e.g. "samsara.cust_001.gps-locations"
   * @param payload Deserialised message payload (plain object)
   */
  async route(topic: string, payload: unknown): Promise<void> {
    // topic format: samsara.{customerId}.{entity-slug}
    // entity slug may itself contain dots (e.g. "odometer-obd") — join remainder
    const parts = topic.split('.');
    if (parts.length < 3 || parts[0] !== 'samsara') {
      this.logger.warnMeta({ topic }, 'Unexpected topic format — skipping', ConsumerService.name);
      return;
    }

    const customerId = parts[1];
    const entitySlug = parts.slice(2).join('.');

    switch (entitySlug) {
      case 'gps-locations':
        await this.gpsLocations.handle(payload, customerId);
        break;
      case 'engine-states':
        await this.engineStates.handle(payload, customerId);
        break;
      case 'odometer-obd':
      case 'odometer-gps':
        await this.odometer.handle(payload, customerId, topic);
        break;
      case 'geofence-events':
        await this.geofenceEvents.handle(payload, customerId);
        break;
      case 'route-events':
        await this.routeEvents.handle(payload, customerId, topic);
        break;
      case 'vehicle-events':
        await this.vehicleEvents.handle(payload, customerId);
        break;
      case 'driver-events':
        await this.driverEvents.handle(payload, customerId);
        break;
      case 'driver-vehicle-roster':
        await this.driverVehicleRoster.handle(payload, customerId);
        break;
      case 'driver-hos-logs':
        await this.driverHosLogs.handle(payload, customerId);
        break;
      default:
        // Supplemental entities (engine-hours, fuel-levels, etc.) — log and continue
        this.logger.debug(`No handler registered for entity slug "${entitySlug}"`, ConsumerService.name);
    }
  }
}
