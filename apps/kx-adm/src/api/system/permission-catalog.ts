import { useAccessStore } from '@vben/stores';

import { apiURL } from '#/api/request';

import { ApiPermissionApi } from './api-permission';
import { SystemMenuApi } from './menu';
import {
  invalidatePermissionCatalog,
  readPermissionCatalog,
} from './permission-catalog-cache';

export function loadPermissionCatalog(refresh = false) {
  if (refresh) invalidatePermissionCatalog();
  const access = useAccessStore();
  return readPermissionCatalog(
    () => JSON.stringify([apiURL, access.accessToken]),
    async () => {
      const [menus, apis] = await Promise.all([
        SystemMenuApi.list(),
        ApiPermissionApi.allGrantOptions(),
      ]);
      return { menus, apis };
    },
  );
}
