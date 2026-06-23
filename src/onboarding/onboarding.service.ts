import { Injectable, UnprocessableEntityException, BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { SecretsService } from '../secrets/secrets.service';
import { DatabaseService } from '../database/database.service';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class OnboardingService {
  private readonly samsaraBaseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly secrets: SecretsService,
    private readonly db: DatabaseService,
    private readonly logger: LoggerService,
  ) {
    this.samsaraBaseUrl = configService.get<string>('samsara.baseUrl') ?? 'https://api.samsara.com';
  }

  async onboardCustomer(customerId: string, apiToken: string): Promise<{ success: boolean; message: string }> {
    const headers = { Authorization: `Bearer ${apiToken}` };

    // Step 1: Validate token is functional
    try {
      await axios.get(`${this.samsaraBaseUrl}/fleet/vehicles?limit=1`, { headers });
    } catch (err: any) {
      const status = err.response?.status;
      this.logger.warnMeta({ customerId, status }, 'Samsara token validation failed', OnboardingService.name);
      if (status === 401) {
        throw new UnprocessableEntityException(
          'Invalid or expired Samsara API token. Please regenerate it in the Samsara Dashboard.',
        );
      }
      throw new BadGatewayException('Unable to reach Samsara API. Please try again.');
    }

    // Step 2: Check for Write Live Sharing Links scope via dry-run
    try {
      await axios.post(
        `${this.samsaraBaseUrl}/live-shares`,
        { type: 'assetsLocation', assetIds: [] },
        { headers },
      );
    } catch (err: any) {
      if (err.response?.status === 403) {
        throw new UnprocessableEntityException(
          'Your Samsara token is missing the "Write Live Sharing Links" scope. ' +
          'Please add it in the Samsara Dashboard under Settings → API Tokens.',
        );
      }
      // Other errors (e.g. 400 for empty assetIds) are acceptable — scope is present
    }

    // Step 3: Store token in Secrets Manager
    await this.secrets.storeSamsaraToken(customerId, apiToken);
    this.logger.log(`Stored Samsara token for customer ${customerId}`, OnboardingService.name);

    // Step 4: Upsert samsara_customers record
    await this.db.upsertSamsaraCustomer({
      customerId,
      status: 'active',
      apiTokenSecretPath: `busie/samsara/${customerId}/api_token`,
    });
    this.logger.info({ customerId }, 'Samsara integration activated', OnboardingService.name);

    return { success: true, message: 'Samsara integration activated.' };
  }
}
