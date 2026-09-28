import axios, { InternalAxiosRequestConfig, AxiosError } from 'axios';
import { propagation, context } from '@opentelemetry/api';
import { getCurrentSpan, addAttributesToCurrentSpan, SpanKind } from './index';

export function initAxiosRequestWithTrace() {
  axios.interceptors.request.use(
    (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
      const span = getCurrentSpan()
      if (span) {
        const attributes: Record<string, any> = {
          "http.url": config.url,
          "http.method": config.method?.toUpperCase(),
          "http.request.query": config.params,
          "kind": SpanKind.CLIENT
        }

        addAttributesToCurrentSpan(attributes)
      }

      // inject header với mỗi axios request
      propagation.inject(context.active(), config.headers)

      return config;
    },
    (error: AxiosError): Promise<AxiosError> => {
      return Promise.reject(error);
    }
  );
}
