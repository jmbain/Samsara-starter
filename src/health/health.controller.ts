import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { KafkaService } from '../kafka/kafka.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly kafkaService: KafkaService) {}

  /**
   * GET /health
   *
   * Load-balancer health check endpoint. Excluded from the /api/samsara prefix.
   * Returns consumer liveness info to surface idle-disconnect issues.
   */
  @Get()
  @ApiOperation({ summary: 'Service health check' })
  check() {
    const lastMessageAt = this.kafkaService.getLastMessageAt();
    const idleSeconds = lastMessageAt
      ? Math.round((Date.now() - lastMessageAt.getTime()) / 1000)
      : null;

    return {
      status: 'ok',
      lastMessageAt: lastMessageAt?.toISOString() ?? null,
      idleSeconds,
    };
  }
}
