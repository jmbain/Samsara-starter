import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class VehicleMapService {
  /** Simple in-process cache to avoid repeated DB round-trips for stable mappings */
  private readonly cache = new Map<string, string>();

  constructor(
    private readonly db: DatabaseService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Look up the Busie vehicle ID for a given Samsara asset ID.
   * Returns null if no mapping exists — callers should skip processing and alert.
   */
  async lookupBusieVehicleId(customerId: string, samsaraAssetId: string): Promise<string | null> {
    const cacheKey = `${customerId}:${samsaraAssetId}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const busieVehicleId = await this.db.findBusieVehicleId(customerId, samsaraAssetId);

    if (busieVehicleId) {
      this.cache.set(cacheKey, busieVehicleId);
    } else {
      this.logger.warnMeta(
        { customerId, samsaraAssetId },
        'samsara_vehicle_map: no mapping found',
        VehicleMapService.name,
      );
    }

    return busieVehicleId;
  }

  /** Invalidate a cache entry — call after a vehicle mapping update event */
  invalidate(customerId: string, samsaraAssetId: string): void {
    this.cache.delete(`${customerId}:${samsaraAssetId}`);
  }

  async upsertMapping(args: {
    customerId: string;
    samsaraAssetId: string;
    busieVehicleId: string;
  }): Promise<void> {
    await this.db.upsertVehicleMapping(args);
    // Invalidate so the next lookup re-reads from DB
    this.invalidate(args.customerId, args.samsaraAssetId);
  }
}
