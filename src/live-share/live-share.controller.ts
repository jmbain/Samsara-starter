import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LiveShareService } from './live-share.service';
import { CreateLiveShareDto } from './dto/create-live-share.dto';

@ApiTags('live-share')
@Controller()
export class LiveShareController {
  constructor(private readonly liveShareService: LiveShareService) {}

  /**
   * POST /api/samsara/live-share
   *
   * Generates a Samsara live sharing link via the REST API.
   * Used for non-routing customers who do not emit RouteStop Kafka events.
   */
  @Post('live-share')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate a Samsara live sharing link' })
  @ApiResponse({ status: 200, description: 'Returns the live sharing URL' })
  @ApiResponse({ status: 400, description: 'Missing required fields' })
  @ApiResponse({ status: 502, description: 'Samsara API error' })
  async createLiveShare(@Body() dto: CreateLiveShareDto) {
    const linkUrl = await this.liveShareService.generateViaRestApi({
      customerId: dto.customerId,
      samsaraAssetId: dto.samsaraAssetId,
      busieVehicleId: dto.busieVehicleId,
      expiresAtTime: dto.expiresAtTime,
    });
    return { linkUrl };
  }
}
