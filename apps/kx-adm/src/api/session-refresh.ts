import type { RequestClient } from '@vben/request';

const REFRESH_AHEAD_MS = 10 * 60 * 1000;
const RETRY_DELAY_MS = 30 * 1000;

/** exp 只决定刷新时机，签名与会话有效性由服务端验证。 */
function expiresAt(token: string): number | undefined {
  try {
    const payload = token.split('.')[1];
    if (!payload) return;
    const { exp } = JSON.parse(
      atob(payload.replaceAll('-', '+').replaceAll('_', '/')),
    );
    if (typeof exp === 'number' && Number.isFinite(exp)) return exp * 1000;
  } catch {
    // 非 JWT 交由服务端鉴权，不因本地解析失败退出。
  }
}

export function createSessionRefresh(options: {
  getToken: () => null | string;
  refresh: (token: string) => Promise<string>;
  setToken: (token: string) => void;
}) {
  let pending: undefined | { promise: Promise<string>; token: string };
  let failure: undefined | { error: unknown; until: number; token: string };
  // 只允许本协调器签发的后继 token 重放旧请求，不能跨账号重放。
  const successors = new Map<string, string>();

  function currentFor(token: string): string {
    const current = options.getToken();
    let successor = token;
    for (let i = 0; i < successors.size; i++) {
      successor = successors.get(successor) ?? successor;
      if (successor === current) return successor;
    }
    if (current === token) return token;
    throw new Error('登录会话已变化');
  }

  function refresh(token: string): Promise<string> {
    const current = currentFor(token);
    if (current !== token) return Promise.resolve(current);
    if (pending?.token === token) return pending.promise;
    if (failure?.token === token && Date.now() < failure.until) {
      return Promise.reject(failure.error);
    }
    const promise = Promise.resolve()
      .then(() => options.refresh(token))
      .then((next) => {
        // 刷新只能替换发起时的会话。
        if (options.getToken() !== token) {
          throw new Error('登录会话已变化');
        }
        successors.set(token, next);
        if (successors.size > 20) {
          const first = successors.keys().next().value;
          if (first) successors.delete(first);
        }
        options.setToken(next);
        failure = undefined;
        return next;
      })
      .catch((error: unknown) => {
        currentFor(token);
        failure = { error, token, until: Date.now() + RETRY_DELAY_MS };
        throw error;
      })
      .finally(() => {
        if (pending?.promise === promise) pending = undefined;
      });
    pending = { promise, token };
    return promise;
  }

  return {
    currentFor,
    async prepare() {
      const token = options.getToken();
      if (!token) return null;
      const expiry = expiresAt(token);
      if (expiry === undefined || expiry - Date.now() > REFRESH_AHEAD_MS) {
        return token;
      }
      if (expiry <= Date.now()) return refresh(token);
      void refresh(token).catch(() => {});
      return token;
    },
    refresh,
  };
}

const NO_REFRESH_PATHS = new Set([
  '/auth/dt/exchange',
  '/auth/user/access_token',
  '/auth/user/logout',
  '/auth/user/mfa/login',
  '/auth/user/refresh_token',
]);

/** 各传输客户端共用同一个协调器；在加密拦截器之后注册，先保存明文。 */
export function addSessionRefreshInterceptors(
  client: RequestClient,
  session: ReturnType<typeof createSessionRefresh>,
  reAuthenticate: () => Promise<void>,
) {
  client.addRequestInterceptor({
    fulfilled: async (config) => {
      if (NO_REFRESH_PATHS.has(config.url?.split('?')[0] ?? '')) return config;
      const state = config as typeof config & {
        __kxSession?: { data: unknown; retry: boolean; token: null | string };
      };
      state.__kxSession ??= { data: config.data, retry: false, token: null };
      try {
        const token =
          state.__kxSession.retry && state.__kxSession.token
            ? session.currentFor(state.__kxSession.token)
            : await session.prepare();
        state.__kxSession.token = token;
        config.headers.Authorization = token ? `Bearer ${token}` : null;
      } catch (error) {
        if (isUnauthorized(error)) await reAuthenticate();
        throw error;
      }
      return config;
    },
  });
  client.addResponseInterceptor({
    rejected: async (error) => {
      const config = error.config;
      const state = config?.__kxSession;
      if (!isUnauthorized(error) || !state?.token) throw error;
      // 先检查是否仍属于当前会话，旧账号的 401 不能退出新账号。
      const current = session.currentFor(state.token);
      if (state.retry) {
        if (current === state.token) await reAuthenticate();
        throw error;
      }
      try {
        state.token = await session.refresh(state.token);
      } catch (refreshError) {
        session.currentFor(state.token);
        if (isUnauthorized(refreshError)) await reAuthenticate();
        throw refreshError;
      }
      state.retry = true;
      return client.request(config.url, { ...config, data: state.data });
    },
  });
}

function isUnauthorized(error: unknown) {
  return (
    (error as { response?: { status?: number } })?.response?.status === 401
  );
}
