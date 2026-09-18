import type { Router } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { preferences } from '@vben/preferences';
import { useAccessStore, useUserStore } from '@vben/stores';
import { startProgress, stopProgress } from '@vben/utils';

import { message } from 'antdv-next';

import { AuthApi } from '#/api/core';
import { accessRoutes, coreRouteNames } from '#/router/routes';
import { useAuthStore } from '#/store';
import { getDingTalkExchangeCode } from '#/views/_core/authentication/dingtalk-exchange-code';

import { generateAccess } from './access';
import { USER_OVERVIEW_ROUTE_NAME } from './routes/core';

/**
 * 通用守卫配置
 * @param router
 */
function setupCommonGuard(router: Router) {
  // 记录已经加载的页面
  const loadedPaths = new Set<string>();

  router.beforeEach((to) => {
    to.meta.loaded = loadedPaths.has(to.path);

    // 页面加载进度条
    if (!to.meta.loaded && preferences.transition.progress) {
      startProgress();
    }
    return true;
  });

  router.afterEach((to) => {
    // 记录页面是否加载,如果已经加载，后续的页面切换动画等效果不在重复执行
    loadedPaths.add(to.path);

    // 关闭页面加载进度条
    if (preferences.transition.progress) {
      stopProgress();
    }
  });
  router.onError(() => stopProgress());
}

/**
 * 权限访问守卫配置
 * @param router
 */
function setupAccessGuard(router: Router) {
  router.beforeEach(async (to, from) => {
    const accessStore = useAccessStore();
    const userStore = useUserStore();
    const authStore = useAuthStore();
    // 基本路由，这些路由不需要进入权限拦截
    const isPublicCoreRoute =
      coreRouteNames.includes(to.name as string) &&
      to.name !== USER_OVERVIEW_ROUTE_NAME;
    if (isPublicCoreRoute) {
      if (
        to.path === LOGIN_PATH &&
        getDingTalkExchangeCode(to.query, window.location.href)
      ) {
        authStore.clearSession();
        return true;
      }
      if (to.path === LOGIN_PATH && accessStore.accessToken) {
        return decodeURIComponent(
          (to.query?.redirect as string) ||
            userStore.userInfo?.homePath ||
            preferences.app.defaultHomePath,
        );
      }
      return true;
    }

    // accessToken 检查
    if (!accessStore.accessToken) {
      // 明确声明忽略权限访问权限，则可以访问
      if (to.meta.ignoreAccess) {
        return true;
      }

      // 没有访问权限，跳转登录页面
      if (to.fullPath !== LOGIN_PATH) {
        return {
          path: LOGIN_PATH,
          // 如不需要，直接删除 query
          query:
            to.fullPath === preferences.app.defaultHomePath
              ? {}
              : { redirect: encodeURIComponent(to.fullPath) },
          // 携带当前跳转的页面，登录后重新跳转该页面
          replace: true,
        };
      }
      return to;
    }

    // 是否已经生成过动态路由
    if (accessStore.isAccessChecked) {
      return true;
    }

    // 菜单与按钮权限一起刷新，避免新菜单沿用旧登录会话的持久化权限码。
    // 读取失败时保持未授权状态，不能继续使用可能已撤销的旧按钮权限。
    try {
      accessStore.setAccessCodes([]);
      const [userInfo, accessCodes] = await Promise.all([
        authStore.fetchUserInfo(),
        AuthApi.accessCodes(),
      ]);
      const userRoles = userInfo.roles ?? [];

      // 生成菜单和路由
      const { accessibleMenus, accessibleRoutes } = await generateAccess({
        roles: userRoles,
        router,
        // 则会在菜单中显示，但是访问会被重定向到403
        routes: accessRoutes,
      });

      // 保存菜单信息和路由信息
      accessStore.setAccessCodes(accessCodes);
      accessStore.setAccessMenus(accessibleMenus);
      accessStore.setAccessRoutes(accessibleRoutes);
      accessStore.setIsAccessChecked(true);
      let redirectPath: string;
      if (from.query.redirect) {
        redirectPath = from.query.redirect as string;
      } else if (to.fullPath === preferences.app.defaultHomePath) {
        redirectPath = preferences.app.defaultHomePath;
      } else if (userInfo.homePath && to.fullPath === userInfo.homePath) {
        redirectPath = userInfo.homePath;
      } else {
        redirectPath = to.fullPath;
      }
      return {
        ...router.resolve(decodeURIComponent(redirectPath)),
        replace: true,
      };
    } catch (error) {
      authStore.clearSession();
      // 登录中的导航错误交给登录页反馈；刷新页面失败则返回可操作的登录页。
      if (from.path === LOGIN_PATH) throw error;
      message.error('用户信息或菜单加载失败，请重新登录');
      return { path: LOGIN_PATH, replace: true };
    }
  });
}

/**
 * 项目守卫配置
 * @param router
 */
function createRouterGuard(router: Router) {
  /** 通用 */
  setupCommonGuard(router);
  /** 权限访问 */
  setupAccessGuard(router);
}

export { createRouterGuard };
