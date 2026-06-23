import { Injectable } from '@nestjs/common';
import { LoggerService } from '../../logger/logger.service';

/**
 * Handles messages from samsara.{customerId}.driver-hos-logs
 *
 * PRIORITY 1 — operational, not just audit.
 *
 * Bus companies must verify driver Hours of Service compliance before assigning
 * drivers to trips. This stream is the real-time data source for pre-dispatch
 * HOS checks. It must be consumed from day one even though the full downstream
 * implementation is deferred.
 *
 * Expected payload shape (Samsara HOS Logs entity):
 * {
 *   happenedAtTime: "2024-01-15T10:30:00Z",
 *   driver: { id: "...", name: "..." },
 *   hosLogEntry: {
 *     dutyStatus: "OFF_DUTY" | "SLEEPER_BED" | "DRIVING" | "ON_DUTY_NOT_DRIVING",
 *     startTime: "...",
 *     endTime: "...",
 *     durationMs: 3600000,
 *     location: { ... }
 *   }
 * }
 */
@Injectable()
export class DriverHosLogsHandler {
  constructor(private readonly logger: LoggerService) {}

  async handle(payload: any, customerId: string): Promise<void> {
    const driverId: string | undefined = payload?.driver?.id;
    const dutyStatus: string | undefined = payload?.hosLogEntry?.dutyStatus;

    if (!driverId) {
      this.logger.warnMeta(
        { customerId },
        'HOS log missing driver.id — skipping',
        DriverHosLogsHandler.name,
      );
      return;
    }

    // TODO: upsert into driver_hos_logs table
    // This data drives pre-dispatch compliance checks — do not discard.
    this.logger.info(
      {
        customerId,
        driverId,
        dutyStatus,
        startTime: payload?.hosLogEntry?.startTime,
        durationMs: payload?.hosLogEntry?.durationMs,
      },
      'HOS log entry received',
      DriverHosLogsHandler.name,
    );
  }
}
