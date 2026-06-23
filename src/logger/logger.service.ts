import { Injectable, LoggerService as NestLoggerService, LogLevel } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';

@Injectable()
export class LoggerService implements NestLoggerService {
  private readonly winston: winston.Logger;

  constructor(private readonly configService: ConfigService) {
    const level = configService.get<string>('app.logLevel') ?? 'info';
    const useSimple = configService.get<boolean>('app.useSimple') ?? true;

    const transports: winston.transport[] = [
      new winston.transports.Console({
        format: useSimple
          ? winston.format.combine(
              winston.format.colorize(),
              winston.format.timestamp({ format: 'HH:mm:ss' }),
              winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
                const ctx = context ? ` [${context}]` : '';
                const extra = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
                return `${timestamp} ${level}${ctx}: ${message}${extra}`;
              }),
            )
          : winston.format.combine(
              winston.format.timestamp(),
              winston.format.json(),
            ),
      }),
    ];

    this.winston = winston.createLogger({ level, transports });
  }

  log(message: string, context?: string): void {
    this.winston.info(message, { context });
  }

  error(message: string, trace?: string, context?: string): void {
    this.winston.error(message, { trace, context });
  }

  warn(message: string, context?: string): void {
    this.winston.warn(message, { context });
  }

  debug(message: string, context?: string): void {
    this.winston.debug(message, { context });
  }

  verbose(message: string, context?: string): void {
    this.winston.verbose(message, { context });
  }

  /** Structured log with arbitrary metadata fields — preferred over plain log() */
  info(meta: Record<string, unknown>, message: string, context?: string): void {
    this.winston.info(message, { ...meta, context });
  }

  /** Structured warning with arbitrary metadata fields */
  warnMeta(meta: Record<string, unknown>, message: string, context?: string): void {
    this.winston.warn(message, { ...meta, context });
  }

  /** Structured error with arbitrary metadata fields */
  errorMeta(meta: Record<string, unknown>, message: string, context?: string): void {
    this.winston.error(message, { ...meta, context });
  }
}
