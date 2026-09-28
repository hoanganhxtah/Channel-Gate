import { IncomingMessage, ServerResponse } from 'http';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { context, defaultTextMapGetter, SpanKind } from '@opentelemetry/api';
import { traceExecutionTime, getCurrentSpan } from './index';

@Injectable()
export class TracingMiddleware implements NestMiddleware {
  use(req: IncomingMessage, res: ServerResponse, next: () => void) {
    const method = req.method;
    const url = req.url;
    const attributes = {
      'http.method': method,
      'http.url': url,
      'http.status_code': res.statusCode,
      'kind': SpanKind.SERVER
    };
    
    const name = `HTTP ${method} ${url}`;
    const propagator = new W3CTraceContextPropagator();

    // Lấy context nếu traceparent được truyền vào
    const parentContext = propagator.extract(
      context.active(),
      req.headers,
      defaultTextMapGetter
    );

    // Lấy traceId nếu có trong header
    let otelTraceId = req.headers['x-trace-id'] as string;

    context.with(
      parentContext, 
      async () => {
        const tracedNext = traceExecutionTime(
          name,
          async () => {
            if (!otelTraceId) {
              const span = getCurrentSpan();
              if (span) {
                otelTraceId = span.spanContext().traceId;
                const spanId = span.spanContext().spanId;
                const xrayTraceId = `1-${otelTraceId.slice(0, 8)}-${otelTraceId.slice(8)}`;
                
                res.setHeader('X-Trace-Id', otelTraceId);
                res.setHeader('X-Amzn-Trace-Id', xrayTraceId);
                res.setHeader('X-Span-Id', spanId);
              }
            }
            next();
          },
          attributes
        );
        await tracedNext();
    });
  }
}
