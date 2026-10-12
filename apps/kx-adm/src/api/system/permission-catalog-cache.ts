import type { ApiPermission } from './api-permission';
import type { SystemMenu } from './menu';

import { cloneDeep } from '@vben/utils';

export interface PermissionCatalog {
  apis: ApiPermission[];
  menus: SystemMenu[];
}

const TTL = 5 * 60 * 1000;
let cached:
  | undefined
  | {
      expiresAt: number;
      promise: Promise<PermissionCatalog>;
      scope: string;
    };

/** 仅缓存分配界面的目录，不缓存用户/角色授权结果和服务端鉴权结果。 */
export function invalidatePermissionCatalog() {
  cached = undefined;
}

export async function readPermissionCatalog(
  currentScope: () => string,
  load: () => Promise<PermissionCatalog>,
): Promise<PermissionCatalog> {
  const scope = currentScope();
  if (!cached || cached.scope !== scope || cached.expiresAt <= Date.now()) {
    const entry = {
      expiresAt: Number.POSITIVE_INFINITY,
      promise: Promise.resolve().then(load),
      scope,
    };
    cached = entry;
    entry.promise = entry.promise.then(
      (data) => {
        entry.expiresAt = Date.now() + TTL;
        return data;
      },
      (error: unknown) => {
        if (cached === entry) cached = undefined;
        throw error;
      },
    );
  }
  const entry = cached;
  const data = await entry.promise;
  if (currentScope() !== scope)
    throw new Error('登录会话已变更，请重新打开权限设置');
  // 写入后失效的在途响应不能重新填回缓存或显示旧目录。
  if (cached !== entry) return readPermissionCatalog(currentScope, load);
  return cloneDeep(data);
}
