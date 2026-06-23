import { Injectable } from '@nestjs/common';
import { VehicleMapService } from '../../vehicle-map/vehicle-map.service';
import { LoggerService } from '../../logger/logger.service';

/**
 * Handles messages from samsara.{customerId}.engine-states
 *
 * Expected payload shape:
 * {
 *   happenedAtTime: "2024-01-15T10:30:00Z",
 *   asset: { id: "samsara-asset-id" },
 *   engineState: { value: "On" | "Off" | "Idle" }
 * }
 */
@Injectable()
export class EngineStatesHandler {
  constructor(
    private readonly vehicleMap: VehicleMapService,
    private readonly logger: LoggerService,
  ) {}

  async handle(payload: any, customerId: string): Promise<void> {
    const samsaraAssetId: string | undefined = payload?.asset?.id;
    if (!samsaraAssetId) {
      this.logger.warnMeta({ customerId }, 'Engine state message missing asset.id — skipping', EngineStatesHandler.name);
      return;
    }

    const busieVehicleId = await this.vehicleMap.lookupBusieVehicleId(customerId, samsaraAssetId);
    if (!busieVehicleId) return;

    const state: string | undefined = payload.engineState?.value;
    if (!state) {
      this.logger.warnMeta({ customerId }, 'Engine state message missing engineState.value — skipping', EngineStatesHandler.name);
      return;
    }

    // TODO: upsert into vehicle_engine_states table
    this.logger.info(
      { customerId, busieVehicleId, state, recordedAt: payload.happenedAtTime },
      'Engine state recorded',
      EngineStatesHandler.name,
    );
  }
}
