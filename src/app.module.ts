import { Module } from '@nestjs/common';
import { AppConfigModule } from './infrastructure/config/app-config.module';
import { LoggingModule } from './infrastructure/logging/logging.module';
import { TracingModule } from './infrastructure/telemetry/telemetry.module';
import { FacebookModule } from './providers/facebook/facebook.module';
import { InstagramModule } from './providers/instagram/instagram.module';
import { ZaloModule } from './providers/zalo/zalo.module';

@Module({
  imports: [
    AppConfigModule,
    TracingModule,
    LoggingModule,
    InstagramModule,
    ZaloModule,
    FacebookModule,
  ],
})
export class AppModule {}
