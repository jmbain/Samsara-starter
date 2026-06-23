import 'reflect-metadata';
import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { ValidationPipe, RequestMethod } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from './logger/logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Wire up custom Winston logger
  const logger = app.get(LoggerService);
  app.useLogger(logger);

  // All routes prefixed with /api/samsara, except /health for load-balancer checks
  app.setGlobalPrefix('api/samsara', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });

  // Validate and transform all incoming DTOs
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
  );

  // Swagger at /api/samsara/docs
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Samsara Integration API')
    .setDescription('Busie × Samsara — onboarding and live-share endpoints')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/samsara/docs', app, document);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') ?? 3000;

  await app.listen(port);
  logger.log(`Samsara service listening on port ${port}`, 'Bootstrap');
}

bootstrap().catch((err) => {
  console.error('Failed to start application', err);
  process.exit(1);
});
