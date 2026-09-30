import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from './infrastructure/logging/logger.service';
import { initializeTracing } from './infrastructure/telemetry';
import { initAxiosRequestWithTrace } from './infrastructure/telemetry/axios-tracing';

async function bootstrap() {
  try {
    console.log('Initializing OpenTelemetry tracing');
    const tracingSdk = initializeTracing();
    if (tracingSdk) {
      console.log('OpenTelemetry tracing initialized successfully');
    }
    initAxiosRequestWithTrace();
  } catch (e) {
    console.error('Failed to initialize OpenTelemetry tracing:', e);
    throw new Error(`Failed to initialize OpenTelemetry tracing: ${e}`);
  }

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = app.get(LoggerService);
  app.useLogger(logger);
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe());

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') ?? 3000;
  await app.listen(port);
  logger.log(`Channel-Gate server is listening on port ${port}`, 'Bootstrap');
}
bootstrap();
