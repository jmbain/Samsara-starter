import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OnboardingService } from './onboarding.service';
import { OnboardCustomerDto } from './dto/onboard-customer.dto';

@ApiTags('onboarding')
@Controller()
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  /**
   * POST /api/samsara/onboard
   *
   * Validates a customer's Samsara API token, checks required scopes, stores the
   * token in AWS Secrets Manager, and activates the integration in the database.
   */
  @Post('onboard')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate Samsara integration for a customer' })
  @ApiResponse({ status: 200, description: 'Integration activated successfully' })
  @ApiResponse({ status: 400, description: 'Missing required fields' })
  @ApiResponse({ status: 422, description: 'Invalid token or missing required scopes' })
  @ApiResponse({ status: 502, description: 'Samsara API unreachable' })
  async onboard(@Body() dto: OnboardCustomerDto) {
    return this.onboardingService.onboardCustomer(dto.customerId, dto.apiToken);
  }
}
