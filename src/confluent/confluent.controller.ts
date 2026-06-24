import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ConfluentService, ProvisionResult } from './confluent.service';
import { ConnectCustomerDto } from './dto/connect-customer.dto';
import { LoggerService } from '../logger/logger.service';

@ApiTags('confluent')
@Controller('confluent')
export class ConfluentController {
  constructor(
    private readonly confluentService: ConfluentService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * POST /api/samsara/confluent/connect
   *
   * Provisions all Confluent Cloud infrastructure required to onboard a new
   * customer onto the Samsara Kafka connector:
   *
   *   1. Creates (or reuses) the dedicated Samsara Confluent cluster
   *   2. Creates 15 per-customer topics (samsara.{customerId}.{entity-slug})
   *   3. Creates a Samsara producer service account + API key for this customer
   *   4. Assigns DeveloperWrite RBAC on the customer's topic prefix to the producer SA
   *   5. Assigns DeveloperRead RBAC on the customer's topic prefix to the shared Busie consumer SA
   *
   * Returns the producer credentials (apiKey + apiSecret) and the list of topic names
   * that the Busie admin must enter into the Samsara dashboard under
   * Settings → Data Streaming → Connected Clusters.
   *
   * NOTE: If the cluster does not yet exist, this request will block for 1–3 minutes
   * while Confluent provisions it. Set CONFLUENT_CLUSTER_ID and
   * CONFLUENT_CLUSTER_REST_ENDPOINT in the environment after the first run to
   * prevent cluster creation on subsequent calls.
   *
   * IMPORTANT: The producerCredentials.apiSecret in the response is returned ONCE only.
   * Store it securely immediately — it cannot be retrieved from Confluent again.
   */
  @Post('connect')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Provision Confluent infrastructure for a new Samsara customer',
    description:
      'Creates topics, service account, API key, and RBAC bindings. ' +
      'Returns producer credentials for entry into the Samsara dashboard.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Provisioning successful. Response contains producer credentials and topic names.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request body.',
  })
  @ApiResponse({
    status: 500,
    description: 'Confluent API error during provisioning.',
  })
  async connect(@Body() dto: ConnectCustomerDto): Promise<ProvisionResult> {
    try {
      return await this.confluentService.provisionCustomer(dto.customerId);
    } catch (err: any) {
      this.logger.errorMeta(
        {
          customerId: dto.customerId,
          status: err?.response?.status,
          data: err?.response?.data,
        },
        'Confluent provisioning failed',
        ConfluentController.name,
      );
      throw new InternalServerErrorException(
        `Confluent provisioning failed: ${err?.response?.data?.message ?? err?.message ?? 'unknown error'}`,
      );
    }
  }
}
