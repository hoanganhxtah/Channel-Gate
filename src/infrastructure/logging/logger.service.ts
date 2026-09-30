import { Injectable, LoggerService as LoggingService } from '@nestjs/common';
import { getTraceInfo } from '../telemetry';
import * as winston from 'winston';

const clc = {
  green: (text: string) => `\x1b[32m${text}\x1b[39m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[39m`,
  red: (text: string) => `\x1b[31m${text}\x1b[39m`,
  magentaBright: (text: string) => `\x1b[95m${text}\x1b[39m`,
  cyanBright: (text: string) => `\x1b[96m${text}\x1b[39m`,
};

@Injectable()
export class LoggerService implements LoggingService {
  private readonly logger: winston.Logger;

  constructor() {
    const consoleFormat = winston.format.combine(
      winston.format.timestamp({ format: 'MM/DD/YYYY, h:mm:ss A' }),
      winston.format.printf(({ level, message, context, timestamp, traceInfo }) => {
        const pid = process.pid;
        let coloredLevel = clc.green('    LOG');
        let coloredMsg = clc.green(String(message));

        if (level === 'error') {
          coloredLevel = clc.red('  ERROR');
          coloredMsg = clc.red(String(message));
        } else if (level === 'warn') {
          coloredLevel = clc.yellow('   WARN');
          coloredMsg = clc.yellow(String(message));
        } else if (level === 'debug') {
          coloredLevel = clc.magentaBright('  DEBUG');
          coloredMsg = clc.magentaBright(String(message));
        } else if (level === 'verbose') {
          coloredLevel = clc.cyanBright('VERBOSE');
          coloredMsg = clc.cyanBright(String(message));
        }

        const ctx = context ? ` ${clc.yellow(`[${context}]`)}` : '';
        const trace = traceInfo ? ` ${clc.cyanBright(String(traceInfo))}` : '';
        return `${clc.green(`[Nest] ${pid}  -`)} ${timestamp} ${coloredLevel}${ctx}${trace} ${coloredMsg}`;
      }),
    );

    const fileFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.printf(({ level, message, context, timestamp, traceInfo }) => {
        const ctx = context ? ` [${context}]` : '';
        const trace = traceInfo ? ` ${traceInfo}` : '';
        return `${timestamp} [${level.toUpperCase()}]${ctx}:${trace} ${message}`;
      }),
    );

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      transports: [
        new winston.transports.Console({ format: consoleFormat }),
        new winston.transports.File({ filename: 'logs/error.log', level: 'error', format: fileFormat }),
        new winston.transports.File({ filename: 'logs/combined.log', format: fileFormat }),
      ],
    });
  }

  private getTraceInfoString(): string | undefined {
    const { traceId, spanId } = getTraceInfo();
    if (!traceId) {
      return undefined;
    }
    return `[trace_id=${traceId} span_id=${spanId}]`;
  }

  private shouldFilterContext(context?: string): boolean {
    if (!context) return false;
    // Bỏ qua log framework routing/instance loader nội bộ khi khởi động (nếu không đặt LOG_NEST_INTERNAL=true)
    const internalContexts = ['RouterExplorer', 'RoutesResolver', 'InstanceLoader'];
    return process.env.LOG_NEST_INTERNAL !== 'true' && internalContexts.includes(context);
  }

  private formatMessage(message: any): string {
    if (typeof message === 'object') {
      try {
        return JSON.stringify(message);
      } catch {
        return String(message);
      }
    }
    return String(message);
  }

  log(message: any, context?: string) {
    if (this.shouldFilterContext(context)) return;
    const formatted = this.formatMessage(message);
    const traceInfo = this.getTraceInfoString();
    this.logger.info(formatted, { context, traceInfo });
  }

  error(message: any, trace?: string, context?: string) {
    const formatted = this.formatMessage(message);
    const traceInfo = this.getTraceInfoString();
    this.logger.error(formatted, { trace, context, traceInfo });
  }

  warn(message: any, context?: string) {
    if (this.shouldFilterContext(context)) return;
    const formatted = this.formatMessage(message);
    const traceInfo = this.getTraceInfoString();
    this.logger.warn(formatted, { context, traceInfo });
  }

  debug(message: any, context?: string) {
    const formatted = this.formatMessage(message);
    const traceInfo = this.getTraceInfoString();
    this.logger.debug(formatted, { context, traceInfo });
  }

  verbose(message: any, context?: string) {
    const formatted = this.formatMessage(message);
    const traceInfo = this.getTraceInfoString();
    this.logger.verbose(formatted, { context, traceInfo });
  }
}
