import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { SecretsService } from '../secrets/secrets.service';
import { DatabaseService } from '../database/database.service';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class LiveShareService {
  private readonly samsaraBaseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly secrets: SecretsService,
    private readonly db: DatabaseService,
    private readonly logger: LoggerService,
  ) {
    this.samsaraBaseUrl = configService.get<string>('samsara.baseUrl') ?? 'https://api.samsara.com';
  }

  /**
   * Generate a live sharing link via the Samsara REST API.
   * Used for non-routing customers who do not emit RouteStop Kafka events.
   *
   * IMPORTANT: expiresAtTime must be an RFC 3339 string (e.g. "2026-06-17T18:00:00Z").
   * Do NOT use expiresAtMs — Samsara API does not accept millisecond timestamps.
   */
  async generateViaRestApi(args: {
    customerId: string;
    samsaraAssetId: string;
    busieVehicleId: string;
    expiresAtTime?: string;
  }): Promise<string> {
    const { customerId, samsaraAssetId, busieVehicleId, expiresAtTime } = args;
    const apiToken = await this.secrets.getSamsaraToken(customerId);

    const body: Record<string, unknown> = {
      type: 'assetsLocation',
      assetIds: [samsaraAssetId],
      ...(expiresAtTime ? { expiresAtTime } : {}),
    };

    const response = await axios.post(`${this.samsaraBaseUrl}/live-shares`, body, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    const linkUrl: string | undefined = response.data?.data?.url;
    if (!linkUrl) throw new Error('Samsara /live-shares response missing data.url');

    // TODO: upsert into live_sharing_links table (source=rest_api, link_type=assetsLocation)
    this.logger.info(
      { customerId, busieVehicleId, samsaraAssetId, linkUrl },
      'Live sharing link generated via REST API',
      LiveShareService.name,
    );

    return linkUrl;
  }

  /**
   * Store a live sharing link that arrived via Kafka route-events.
   * Called by RouteEventsHandler on RouteStopDeparture events.
   */
  async upsertFromKafka(args: {
    customerId: string;
    busieVehicleId: string;
    samsaraAssetId: string;
    samsaraRouteStopId?: string | null;
    linkUrl: string;
  }): Promise<void> {
    await this.db.upsertLiveSharingLink({
      ...args,
      linkType: 'routeStopLink',
      source: 'kafka',
    });
    this.logger.info(
      { customerId: args.customerId, busieVehicleId: args.busieVehicleId, stopId: args.samsaraRouteStopId },
      'Live sharing link stored from Kafka',
      LiveShareService.name,
    );
  }
}
