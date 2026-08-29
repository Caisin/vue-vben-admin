/**
 * Playground 请求客户端，适配 kx-axum 统一响应 `{ code, result, msg }`。
 */
import type { AxiosResponseHeaders, RequestClientOptions } from '@vben/request';

import { LOGIN_PATH } from '@vben/constants';
import { useAppConfig } from '@vben/hooks';
import { preferences } from '@vben/preferences';
import {
  authenticateResponseInterceptor,
  defaultResponseInterceptor,
  errorMessageResponseInterceptor,
  RequestClient,
} from '@vben/request';
import { useAccessStore } from '@vben/stores';
import { cloneDeep } from '@vben/utils';

import {
  addApiSecurityInterceptors,
  addPlaintextHttpSourceInterceptors,
} from '@kx/admin-core';
import { message } from 'antdv-next';
import JSONBigInt from 'json-bigint';

import { AuthApi } from '#/api/core';
import { requestErrorMessage } from '#/request-errors';
import { useAuthStore } from '#/store';
export { isRequestNotFound } from '#/request-errors';

export const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);

export type JsonPrimitive = boolean | null | number | string;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface PageQuery {
  descending?: boolean;
  page?: number;
  size?: number;
  sort?: string | string[];
}

export interface Page<T> {
  items: T[];
  paging: {
    page: number;
    size: number;
  };
  total: number;
  total_pages: number;
}

export interface PageFetchParams extends PageQuery {
  [key: string]: JsonValue | JsonValue[] | undefined;
  pageNo?: number;
  pageSize?: number;
}

function parseJsonBigInt(data: unknown, header: AxiosResponseHeaders) {
  // 保留后端 i64/BigInt 精度，统一按字符串保存。
  if (
    header.getContentType()?.toString().includes('application/json') &&
    typeof data === 'string'
  ) {
    return cloneDeep(
      JSONBigInt({ storeAsString: true, strict: true }).parse(data),
    );
  }
  return data;
}

function formatToken(token: null | string) {
  return token ? `Bearer ${token}` : null;
}

function isLoginPageLocation() {
  const pathname = globalThis.location?.pathname ?? '';
  const hashPath = (globalThis.location?.hash ?? '').slice(1).split('?')[0];
  return pathname.endsWith(LOGIN_PATH) || hashPath === LOGIN_PATH;
}

function addCommonRequestHeaders(client: RequestClient) {
  client.addRequestInterceptor({
    fulfilled: async (config) => {
      const accessStore = useAccessStore();
      config.headers.Authorization = formatToken(accessStore.accessToken);
      config.headers['Accept-Language'] = preferences.app.locale;
      return config;
    },
  });
}

function addKxAxumResponseInterceptor(client: RequestClient) {
  // kx-axum 成功响应为 `{ code: 200, result, msg }`。
  client.addResponseInterceptor(
    defaultResponseInterceptor({
      codeField: 'code',
      dataField: 'result',
      successCode: 200,
    }),
  );
}

function addErrorMessageInterceptor(client: RequestClient) {
  client.addResponseInterceptor(
    errorMessageResponseInterceptor((msg: string, error) => {
      message.error(requestErrorMessage(error, msg));
    }),
  );
}

function createBareRequestClient(
  baseURL: string,
  options?: RequestClientOptions,
) {
  const client = new RequestClient({
    ...options,
    baseURL,
    transformResponse: parseJsonBigInt,
  });

  addCommonRequestHeaders(client);
  addApiSecurityInterceptors(client);
  addKxAxumResponseInterceptor(client);

  return client;
}

function createPlaintextRequestClient(
  baseURL: string,
  options?: RequestClientOptions,
) {
  const client = new RequestClient({
    ...options,
    baseURL,
    transformResponse: parseJsonBigInt,
  });

  addCommonRequestHeaders(client);
  addPlaintextHttpSourceInterceptors(client);
  addKxAxumResponseInterceptor(client);

  return client;
}

function createRequestClient(baseURL: string, options?: RequestClientOptions) {
  const client = createBareRequestClient(baseURL, options);

  /**
   * 重新认证逻辑。
   */
  async function doReAuthenticate() {
    console.warn('Access token or refresh token is invalid or expired. ');
    const accessStore = useAccessStore();
    const authStore = useAuthStore();
    if (authStore.isLoggingOut) return;
    accessStore.setAccessToken(null);
    // 登录页或 MFA 流程中的迟到 401 来自旧会话，不得重新唤起已失活布局中的登录过期 Teleport。
    if (authStore.pendingMfaLogin || isLoginPageLocation()) {
      accessStore.setLoginExpired(false);
      return;
    }
    if (
      preferences.app.loginExpiredMode === 'modal' &&
      accessStore.isAccessChecked
    ) {
      accessStore.setLoginExpired(true);
    } else {
      await authStore.logout();
    }
  }

  /**
   * 使用当前 Bearer Token 换取新 Token。
   */
  async function doRefreshToken() {
    const accessStore = useAccessStore();
    const body = await AuthApi.refreshToken();
    const newToken = body.access_token;
    accessStore.setAccessToken(newToken);
    return newToken;
  }

  client.addResponseInterceptor(
    authenticateResponseInterceptor({
      client,
      doReAuthenticate,
      doRefreshToken,
      enableRefreshToken: preferences.app.enableRefreshToken,
      formatToken,
    }),
  );

  addErrorMessageInterceptor(client);

  return client;
}

export const requestClient = createRequestClient(apiURL, {
  responseReturn: 'data',
});

export const encryptedRequestClient = createBareRequestClient(apiURL, {
  responseReturn: 'data',
});
addErrorMessageInterceptor(encryptedRequestClient);

/** 仅供后端显式声明 `Plaintext` 的 API 使用。 */
export const plaintextRequestClient = createPlaintextRequestClient(apiURL, {
  responseReturn: 'data',
});
addErrorMessageInterceptor(plaintextRequestClient);
