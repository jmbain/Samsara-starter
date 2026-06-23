import { Global, Module } from '@nestjs/common';
import { VehicleMapService } from './vehicle-map.service';

@Global()
@Module({
  providers: [VehicleMapService],
  exports: [VehicleMapService],
})
export class VehicleMapModule {}
