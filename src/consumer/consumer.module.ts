import { Module } from '@nestjs/common';
import { ConsumerService } from './consumer.service';
import { GpsLocationsHandler } from './handlers/gps-locations.handler';
import { EngineStatesHandler } from './handlers/engine-states.handler';
import { OdometerHandler } from './handlers/odometer.handler';
import { GeofenceEventsHandler } from './handlers/geofence-events.handler';
import { RouteEventsHandler } from './handlers/route-events.handler';
import { VehicleEventsHandler } from './handlers/vehicle-events.handler';
import { DriverEventsHandler } from './handlers/driver-events.handler';
import { DriverVehicleRosterHandler } from './handlers/driver-vehicle-roster.handler';
import { DriverHosLogsHandler } from './handlers/driver-hos-logs.handler';

@Module({
  providers: [
    ConsumerService,
    GpsLocationsHandler,
    EngineStatesHandler,
    OdometerHandler,
    GeofenceEventsHandler,
    RouteEventsHandler,
    VehicleEventsHandler,
    DriverEventsHandler,
    DriverVehicleRosterHandler,
    DriverHosLogsHandler,
  ],
  exports: [ConsumerService],
})
export class ConsumerModule {}
