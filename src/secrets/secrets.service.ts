import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
  CreateSecretCommand,
  PutSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class SecretsService {
  private readonly client: SecretsManagerClient;
  /** In-process cache — tokens are stable; invalidated on 401 from Samsara */
  private readonly tokenCache = new Map<string, string>();

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.client = new SecretsManagerClient({
      region: configService.get<string>('aws.region') ?? 'us-east-1',
    });
  }

  /**
   * Fetch the Samsara API token for a given customer from AWS Secrets Manager.
   * Secret path: busie/samsara/{customerId}/api_token
   *
   * Dev shortcut: if SAMSARA_API_TOKEN is set in env, returns it directly without
   * hitting Secrets Manager — useful for local single-customer development.
   */
  async getSamsaraToken(customerId: string): Promise<string> {
    const devToken = this.configService.get<string>('samsara.devApiToken');
    if (devToken) return devToken;

    if (this.tokenCache.has(customerId)) {
      return this.tokenCache.get(customerId)!;
    }

    const secretId = `busie/samsara/${customerId}/api_token`;
    const result = await this.client.send(new GetSecretValueCommand({ SecretId: secretId }));
    const token = result.SecretString;

    if (!token) throw new Error(`No secret value found for ${secretId}`);

    this.tokenCache.set(customerId, token);
    return token;
  }

  /**
   * Store a Samsara API token in AWS Secrets Manager.
   * Creates the secret if it does not yet exist; updates it otherwise.
   * Secret path: busie/samsara/{customerId}/api_token
   */
  async storeSamsaraToken(customerId: string, apiToken: string): Promise<void> {
    const secretId = `busie/samsara/${customerId}/api_token`;

    try {
      await this.client.send(new PutSecretValueCommand({
        SecretId: secretId,
        SecretString: apiToken,
      }));
      this.logger.log(`Updated secret ${secretId}`, SecretsService.name);
    } catch (err: any) {
      if (err?.name === 'ResourceNotFoundException') {
        await this.client.send(new CreateSecretCommand({
          Name: secretId,
          SecretString: apiToken,
          Description: `Samsara API token for Busie customer ${customerId}`,
        }));
        this.logger.log(`Created secret ${secretId}`, SecretsService.name);
      } else {
        throw err;
      }
    }

    // Invalidate cache so next read fetches the new value
    this.tokenCache.delete(customerId);
  }

  /** Call on 401 from Samsara so the next request re-fetches from Secrets Manager */
  invalidateToken(customerId: string): void {
    this.tokenCache.delete(customerId);
  }
}
