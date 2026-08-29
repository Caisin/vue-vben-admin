import type { Router, RouteRecordName } from 'vue-router';

import type {
  ComponentRecordType,
  GenerateMenuAndRoutesOptions,
  RouteRecordStringComponent,
} from '@vben/types';

import { generateAccessible } from '@vben/access';
import { preferences } from '@vben/preferences';
import { useAccessStore, useTabbarStore, useUserStore } from '@vben/stores';
import { resetStaticRoutes } from '@vben/utils';

import { message } from 'antdv-next';

import { AuthApi, getAllMenusApi } from '#/api/core';
import { BasicLayout, IFrameView } from '#/layouts';
import { $t } from '#/locales';
import { pageMap } from '#/products/pages';
import { accessRoutes, routes } from '#/router/routes';

import { resolvePermissionRefreshTarget } from './permission-refresh';

const forbiddenComponent = () => import('#/views/_core/fallback/forbidden.vue');

async function generateAccess(
  options: GenerateMenuAndRoutesOptions,
  menuList?: RouteRecordStringComponent[],
) {
  const layoutMap: ComponentRecordType = {
    BasicLayout,
    IFrameView,
  };

  return await generateAccessible(preferences.app.accessMode, {
    ...options,
    fetchMenuListAsync: async () => {
      message.loading({
        content: `${$t('common.loadingMenu')}...`,
        duration: 1.5,
      });
      return menuList ?? (await getAllMenusApi());
    },
    // 可以指定没有权限跳转403页面
    forbiddenComponent,
    // 如果 route.meta.menuVisibleWithForbidden = true
    layoutMap,
    pageMap,
  });
}

/**
 * 重新加载当前会话的用户、按钮权限码和动态菜单，无需更换 access token。
 */
async function refreshCurrentAccess(router: Router) {
  const accessStore = useAccessStore();
  const tabbarStore = useTabbarStore();
  const userStore = useUserStore();
  const currentRoute = router.currentRoute.value;

  // 所有远端读取成功后才移除旧路由，避免网络失败破坏当前可用会话。
  const [userInfo, accessCodes, menuList] = await Promise.all([
    AuthApi.userInfo(),
    AuthApi.accessCodes(),
    getAllMenusApi(),
  ]);

  resetStaticRoutes(router, routes);
  accessStore.setIsAccessChecked(false);

  try {
    const { accessibleMenus, accessibleRoutes } = await generateAccess(
      {
        roles: userInfo.roles ?? [],
        router,
        routes: accessRoutes,
      },
      menuList,
    );

    userStore.setUserInfo(userInfo);
    accessStore.setAccessCodes(accessCodes);
    accessStore.setAccessMenus(accessibleMenus);
    accessStore.setAccessRoutes(accessibleRoutes);
    accessStore.setIsAccessChecked(true);

    const availableRouteNames = new Set<RouteRecordName>(
      router
        .getRoutes()
        .map((route) => route.name)
        .filter((name): name is RouteRecordName => name !== undefined),
    );
    tabbarStore.tabs = tabbarStore.tabs.filter(
      (tab) => !tab.name || availableRouteNames.has(tab.name),
    );
    await tabbarStore.updateCacheTabs();

    const targetPath = resolvePermissionRefreshTarget({
      currentFullPath: currentRoute.fullPath,
      currentRouteAvailable:
        currentRoute.name !== undefined && router.hasRoute(currentRoute.name),
      homePath: userInfo.homePath,
    });
    await router.replace(targetPath);
    return targetPath;
  } catch (error) {
    // 让下次导航回到既有守卫的完整权限加载流程。
    accessStore.setIsAccessChecked(false);
    throw error;
  }
}

export { generateAccess, refreshCurrentAccess };
