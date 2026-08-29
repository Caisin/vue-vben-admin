import type {
  InternalAxiosRequestConfig,
  RequestClient,
  RequestResponse,
} from '@vben/request';

import { cloneDeep } from '@vben/utils';

import JSONBigInt from 'json-bigint';

import { KxEd } from './transport-ed';

type HttpTransport = 'encrypted' | 'plaintext';

function parseJsonText(data: string) {
  return cloneDeep(
    JSONBigInt({ storeAsString: true, strict: true }).parse(data),
  );
}

function parsePlaintextJsonBuffer(data: ArrayBuffer) {
  return parseJsonText(new TextDecoder().decode(new Uint8Array(data)));
}

function requestSource(config: InternalAxiosRequestConfig) {
  return config.data === undefined ? config.params : config.data;
}

function logHttpSource(
  transport: HttpTransport,
  direction: 'request' | 'response',
  config: InternalAxiosRequestConfig,
  data: unknown,
) {
  if (!import.meta.env.DEV) return;
  const method = (config.method ?? 'GET').toUpperCase();
  // oxlint-disable-next-line no-console -- 开发模式需要显示加密前和解密后的协议源数据。
  console.info(
    `[KX HTTP][${transport} ${direction}] ${method} ${config.url ?? ''}`,
    data,
  );
}

function isJsonRequestData(data: unknown) {
  if (data === undefined || data === null) return true;
  if (typeof FormData !== 'undefined' && data instanceof FormData) return false;
  return !(
    data instanceof ArrayBuffer ||
    (typeof Blob !== 'undefined' && data instanceof Blob)
  );
}

function encodeEncryptedRequest(config: InternalAxiosRequestConfig) {
  if (!isJsonRequestData(config.data)) {
    throw new TypeError(
      '当前接口要求参数加密，但请求体不是 JSON；请为上传或流式接口使用明文 HTTP 客户端',
    );
  }
  logHttpSource('encrypted', 'request', config, requestSource(config));
  config.headers.set('security', 'true');
  config.responseType = 'arraybuffer';
  if (config.data !== undefined) {
    const encrypted = KxEd.encryptText(JSONBigInt.stringify(config.data));
    config.data = KxEd.toArrayBuffer(encrypted);
  }
  return config;
}

function decodeEncryptedResponse(response: RequestResponse) {
  if (response.config.headers?.get('security') !== 'true') return response;
  if (!(response.data instanceof ArrayBuffer)) {
    throw new TypeError('接口加密响应不是 ArrayBuffer');
  }
  const contentType = response.headers['content-type']?.toString() ?? '';
  let decrypted: Uint8Array;
  try {
    decrypted = KxEd.decrypt(response.data);
  } catch (error) {
    // JSON extractor 等进入 handler 前的错误由 Axum 直接返回明文 4xx。
    // 加密客户端仍需解析这类响应，否则 RequestClient 只会把 ArrayBuffer 抛给页面。
    if (response.status >= 400 && contentType.includes('json')) {
      try {
        response.data = parsePlaintextJsonBuffer(response.data);
        logHttpSource('encrypted', 'response', response.config, response.data);
        return response;
      } catch {
        // 保留原始解密错误，避免吞掉真正损坏的加密响应。
      }
    }
    throw error;
  }
  response.data = contentType.includes('json')
    ? parseJsonText(KxEd.decodeText(decrypted))
    : KxEd.toArrayBuffer(decrypted);
  logHttpSource('encrypted', 'response', response.config, response.data);
  return response;
}

/** 为 KxEd HTTP 客户端安装请求加密、响应解密和开发源数据日志。 */
export function addApiSecurityInterceptors(client: RequestClient) {
  client.addRequestInterceptor({
    fulfilled: encodeEncryptedRequest,
  });
  client.addResponseInterceptor({
    fulfilled: decodeEncryptedResponse,
    rejected: (error) => {
      if (error?.response) decodeEncryptedResponse(error.response);
      return Promise.reject(error);
    },
  });
}

/** 为显式明文 HTTP 客户端安装仅开发模式启用的源数据日志。 */
export function addPlaintextHttpSourceInterceptors(client: RequestClient) {
  client.addRequestInterceptor({
    fulfilled: (config) => {
      logHttpSource('plaintext', 'request', config, requestSource(config));
      return config;
    },
  });
  client.addResponseInterceptor({
    fulfilled: (response) => {
      logHttpSource('plaintext', 'response', response.config, response.data);
      return response;
    },
    rejected: (error) => {
      if (error?.response) {
        logHttpSource(
          'plaintext',
          'response',
          error.response.config,
          error.response.data,
        );
      }
      return Promise.reject(error);
    },
  });
}
