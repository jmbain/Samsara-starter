import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, QueryResult } from 'pg';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {}

  onModuleInit(): void {
    const connectionString = this.configService.get<string>('db.connectionString');
    this.pool = new Pool({ connectionString });
    this.pool.on('error', (err) => {
      this.logger.errorMeta({ err }, 'Unexpected DB pool error', DatabaseService.name);
    });
    this.logger.log('Database pool initialised', DatabaseService.name);
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
    this.logger.log('Database pool closed', DatabaseService.name);
  }

  async query<T = unknown>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  // ── Vehicle locations ────────────────────────────────────────────────────

  async upsertVehicleLocation(args: {
    customerId: string;
    busieVehicleId: string;
    samsaraAssetId: string;
    recordedAt: string;
    lat: number;
    lng: number;
    headingDegrees?: number;
    gpsSpeedMs?: number;
    ecuSpeedMs?: number;
    addressJson?: Record<string, unknown> | null;
    geofenceId?: string | null;
  }): Promise<void> {
    const {
      customerId, busieVehicleId, samsaraAssetId, recordedAt,
      lat, lng, headingDegrees, gpsSpeedMs, ecuSpeedMs, addressJson, geofenceId,
    } = args;
    await this.pool.query(
      `INSERT INTO vehicle_locations
         (customer_id, busie_vehicle_id, samsara_asset_id, recorded_at,
          lat, lng, heading_degrees, gps_speed_ms, ecu_speed_ms, address_json, geofence_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (busie_vehicle_id, recorded_at) DO UPDATE SET
         lat              = EXCLUDED.lat,
         lng              = EXCLUDED.lng,
         heading_degrees  = EXCLUDED.heading_degrees,
         gps_speed_ms     = EXCLUDED.gps_speed_ms,
         ecu_speed_ms     = EXCLUDED.ecu_speed_ms,
         address_json     = EXCLUDED.address_json,
         geofence_id      = EXCLUDED.geofence_id`,
      [
        customerId, busieVehicleId, samsaraAssetId, recordedAt,
        lat, lng, headingDegrees ?? null, gpsSpeedMs ?? null, ecuSpeedMs ?? null,
        addressJson ? JSON.stringify(addressJson) : null, geofenceId ?? null,
      ],
    );
  }

  // ── Vehicle map ──────────────────────────────────────────────────────────

  async findBusieVehicleId(customerId: string, samsaraAssetId: string): Promise<string | null> {
    const result = await this.pool.query<{ busie_vehicle_id: string }>(
      `SELECT busie_vehicle_id
       FROM samsara_vehicle_map
       WHERE customer_id = $1 AND samsara_asset_id = $2
       LIMIT 1`,
      [customerId, samsaraAssetId],
    );
    return result.rows[0]?.busie_vehicle_id ?? null;
  }

  async upsertVehicleMapping(args: {
    customerId: string;
    samsaraAssetId: string;
    busieVehicleId: string;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO samsara_vehicle_map (customer_id, samsara_asset_id, busie_vehicle_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (customer_id, samsara_asset_id)
       DO UPDATE SET busie_vehicle_id = EXCLUDED.busie_vehicle_id, updated_at = NOW()`,
      [args.customerId, args.samsaraAssetId, args.busieVehicleId],
    );
  }

  // ── Samsara customers ────────────────────────────────────────────────────

  async upsertSamsaraCustomer(args: {
    customerId: string;
    status: string;
    apiTokenSecretPath: string;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO samsara_customers (customer_id, status, api_token_secret_path, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (customer_id)
       DO UPDATE SET status = EXCLUDED.status,
                     api_token_secret_path = EXCLUDED.api_token_secret_path,
                     updated_at = NOW()`,
      [args.customerId, args.status, args.apiTokenSecretPath],
    );
  }

  // ── Live sharing links ───────────────────────────────────────────────────

  async upsertLiveSharingLink(args: {
    customerId: string;
    busieVehicleId: string;
    samsaraAssetId: string;
    samsaraRouteStopId?: string | null;
    linkUrl: string;
    linkType: string;
    source: string;
  }): Promise<void> {
    // TODO: implement once live_sharing_links schema is finalised
    // ON CONFLICT (customer_id, busie_vehicle_id, samsara_route_stop_id, link_type) DO UPDATE ...
  }
}
