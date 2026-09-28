import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import {
  trace,
  context,
  SpanKind,
  SpanStatusCode,
  Span,
  Tracer,
} from "@opentelemetry/api";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";

const DEFAULT_SERVICE_NAME = "integration_channel";
const DEFAULT_ENDPOINT = "http://localhost:4318/v1/traces";
const serviceName = process.env.OTEL_SERVICE_NAME || DEFAULT_SERVICE_NAME;


function initializeTracing(): NodeSDK {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || DEFAULT_ENDPOINT;

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
  });

  const traceExporter = new OTLPTraceExporter({
    url: endpoint,
  });

  // Sử dụng BatchSpanProcessor để gửi spans theo batch hiệu quả hơn
  const spanProcessor = new BatchSpanProcessor(traceExporter, {
    maxQueueSize: 2048,
    maxExportBatchSize: 512,
    scheduledDelayMillis: 5000,
  });

  const sdk = new NodeSDK({
    resource,
    spanProcessor,
  });

  sdk.start();

  process.on("SIGTERM", () => {
    sdk
      .shutdown()
      .then(() => console.log("Tracing terminated"))
      .catch((error) => console.error("Error shutting down tracing", error))
      .finally(() => process.exit(0));
  });

  // Trả về SDK để có thể tham chiếu sau này nếu cần
  return sdk;
}

interface SpanOptions {
  kind?: SpanKind;
  attributes?: Record<string, any>;
}

/**
 * Tạo span mới - sử dụng để bắt đầu theo dõi một hành động
 *
 * @param {string} name - Tên của span
 * @param {SpanOptions} options - Các tùy chọn cho span
 * @returns {Span} Đối tượng span đã tạo
 */
function createSpan(name: string, options: SpanOptions = {}): Span {
  const tracer = trace.getTracer(serviceName);
  return tracer.startSpan(name, {
    kind: options.kind || SpanKind.INTERNAL,
    attributes: options.attributes || {},
  });
}

/**
 * Thực thi một hàm trong context của span
 *
 * @param {string} name - Tên của span
 * @param {Function} fn - Hàm cần thực thi
 * @param {SpanOptions} options - Các tùy chọn cho span
 * @returns {any} Kết quả của hàm fn
 */
async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  options: SpanOptions = {}
) {
  const span = createSpan(name, options);

  try {
    // Thực thi hàm trong context của span
    return await context.with(
      trace.setSpan(context.active(), span),
      async () => {
        try {
          return await fn(span);
        } catch (error) {
          // Ghi lại lỗi trong span
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : String(error),
          });
          span.recordException(
            error instanceof Error ? error : new Error(String(error))
          );
          throw error;
        }
      }
    );
  } finally {
    span.end();
  }
}

/**
 * Tạo span và tự động kết thúc khi hàm hoàn tất (decorator dạng HOF)
 *
 * @param {string} name - Tên của span
 * @param {SpanOptions} options - Các tùy chọn cho span
 * @returns {Function} Higher-order function decorator
 */
function traceFunction(name?: string, options: SpanOptions = {}) {
  return function (target: any, key: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return withSpan(
        name || key,
        async () => {
          // Thêm thông tin về tham số nếu cần
          return await originalMethod.apply(this, args);
        },
        options
      );
    };

    return descriptor;
  };
}

/**
 * Lấy tracer hiện tại để tạo span thủ công
 *
 * @returns {Tracer} Đối tượng tracer
 */
function getTracer(): Tracer {
  return trace.getTracer(serviceName);
}

/**
 * Lấy span hiện tại từ context
 *
 * @returns {Span|undefined} Span hiện tại hoặc undefined nếu không có
 */
function getCurrentSpan(): Span | undefined {
  return trace.getSpan(context.active());
}

/**
 * Thêm thuộc tính vào span hiện tại
 *
 * @param {Record<string, any>} attributes - Các thuộc tính cần thêm
 * @returns {boolean} true nếu thành công, false nếu không có span hiện tại
 */
function addAttributesToCurrentSpan(attributes: Record<string, any>) {
  const span = getCurrentSpan();
  if (span) {
    span.setAttributes(attributes);
    return true;
  }
  return false;
}

interface TraceExecutionOptions extends SpanOptions {
  includeArgs?: boolean;
}

/**
 * Bọc (wrap) một hàm để đo thời gian thực thi của nó
 *
 * @param {string} name - Tên của span/hoạt động
 * @param {Function} fn - Hàm cần đo thời gian thực thi
 * @param {TraceExecutionOptions} options - Các tùy chọn cho span
 * @returns {Function} Hàm đã được wrap sẽ tự động tạo span và ghi thời gian
 */
function traceExecutionTime<T extends (...args: any[]) => Promise<any>>(
  name: string,
  fn: T,
  options: TraceExecutionOptions = {}
) {
  return async function (this: any, ...args: Parameters<T>) {
    // Đo thời gian bắt đầu
    const startTime = performance.now();

    // Thực thi hàm trong context của một span
    const result = await withSpan(
      name,
      async (span) => {
        // Thêm thông tin về tham số nếu cần
        if (options.includeArgs && args.length > 0) {
          // Chỉ thêm thông tin tham số an toàn, tránh thông tin nhạy cảm
          const safeArgs = args.map((arg) => {
            if (typeof arg === "object" && arg !== null) {
              // Loại bỏ các trường nhạy cảm
              const { password, token, secret, ...safeArg } = arg;
              return JSON.stringify(safeArg);
            }
            return String(arg);
          });

          span.setAttribute("function.arguments.count", args.length);
          span.setAttribute(
            "function.arguments.types",
            args.map((arg) => typeof arg).join(",")
          );
        }

        // Gọi hàm gốc với các tham số được truyền vào
        const result = await fn.apply(this, args);
        // Đo thời gian kết thúc và tính thời gian thực thi
        const endTime = performance.now();
        const executionTime = endTime - startTime;

        // Thêm thông tin thời gian vào span hiện tại
        addAttributesToCurrentSpan({
          "execution.time.ms": executionTime,
          "execution.time.readable": `${executionTime.toFixed(2)}ms`,
        });
        return result;
      },
      options
    );

    return result;
  };
}

/**
 * Lấy thông tin traceId, spanId
 */
function getTraceInfo() {
  const span = trace.getSpan(context.active());
  if (!span) return { traceId: null, spanId: null };
  const spanCtx = span.spanContext();
  return {
    traceId: spanCtx.traceId,
    spanId: spanCtx.spanId,
  };
}

// Export các hàm để sử dụng
export {
  initializeTracing,
  createSpan,
  withSpan,
  traceFunction,
  traceExecutionTime,
  getTracer,
  getCurrentSpan,
  addAttributesToCurrentSpan,
  getTraceInfo,
  // Export các hằng số từ OpenTelemetry API
  SpanKind,
  SpanStatusCode,
};
