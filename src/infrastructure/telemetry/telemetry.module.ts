import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { TracingMiddleware } from './tracing.middleware';

@Module({
  providers: [],
  exports: []
})
export class TracingModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TracingMiddleware)
      .forRoutes('*');
  }
}
