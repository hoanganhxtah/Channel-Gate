import { Injectable, LoggerService as LoggingService } from '@nestjs/common';
import { getTraceInfo } from '../telemetry';
import * as winston from 'winston';

@Injectable()
export class LoggerService implements LoggingService {
  private readonly logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: 'info', // Cấp độ log mặc định
      format: winston.format.combine(
        winston.format.colorize(), // Thêm màu sắc cho cấp độ log
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, context }) => {
          return `${timestamp} [${level}]${context ? ` [${context}]` : ''}: ${message}`;
        }),
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
      ],
    });
  }

  private addTraceInfo() {
    const { traceId, spanId } = getTraceInfo();
    const traceInfo = `trace_id=${traceId} span_id=${spanId}`;
    return traceInfo
  }

  log(message: string, context?: string) {
    const traceInfo = this.addTraceInfo();
    message = `[${traceInfo}] ${message}`;
    this.logger.info(message, { context });
  }

  error(message: string, trace?: string, context?: string) {
    const traceInfo = this.addTraceInfo();
    message = `[${traceInfo}] ${message}`;
    this.logger.error(message, { trace, context });
  }

  warn(message: string, context?: string) {
    const traceInfo = this.addTraceInfo();
    message = `[${traceInfo}] ${message}`;
    this.logger.warn(message,{ context });
  }

  debug(message: string, context?: string) {
    const traceInfo = this.addTraceInfo();
    message = `[${traceInfo}] ${message}`;
    this.logger.debug(message, { context });
  }

  verbose(message: string, context?: string) {
    const traceInfo = this.addTraceInfo();
    message = `[${traceInfo}] ${message}`;
    this.logger.verbose(message, { context });
  }
}
