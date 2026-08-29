import type { RouteRecordRaw } from 'vue-router';

import type {
  ComponentRecordType,
  GenerateMenuAndRoutesOptions,
  RouteRecordStringComponent,
} from '@vben-core/typings';

import { mapTree } from '@vben-core/shared/utils';

/**
 * 判断路由是否在菜单中显示但访问时展示 403（让用户知悉功能并申请权限）
 */
function menuHasVisibleWithForbidden(route: RouteRecordRaw): boolean {
  return !!route.meta?.menuVisibleWithForbidden;
}

/**
 * 动态生成路由 - 后端方式
 * 对 meta.menuVisibleWithForbidden 为 true 的项直接替换为 403 组件，让用户知悉功能并申请权限。
 */
async function generateRoutesByBackend(
  options: GenerateMenuAndRoutesOptions,
): Promise<RouteRecordRaw[]> {
  const {
    fetchMenuListAsync,
    layoutMap = {},
    pageMap = {},
    forbiddenComponent,
  } = options;

  try {
    const menuRoutes = await fetchMenuListAsync?.();
    if (!menuRoutes) {
      return [];
    }

    const normalizePageMap: ComponentRecordType = {};

    for (const [key, value] of Object.entries(pageMap)) {
      normalizePageMap[normalizeViewPath(key)] = value;
    }

    let routes = convertRoutes(menuRoutes, layoutMap, normalizePageMap);

    if (forbiddenComponent) {
      routes = mapTree(routes, (route) => {
        if (menuHasVisibleWithForbidden(route)) {
          route.component = forbiddenComponent;
        }
        return route;
      });
    }

    return routes;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

function convertRoutes(
  routes: RouteRecordStringComponent[],
  layoutMap: ComponentRecordType,
  pageMap: ComponentRecordType,
): RouteRecordRaw[] {
  return mapTree(routes, (node) => {
    const route = node as unknown as RouteRecordRaw;
    const { component, name } = node;

    if (!name) {
      console.error('route name is required', route);
    }

    // layout转换
    if (component && layoutMap[component]) {
      route.component = layoutMap[component];
      // 页面组件转换
    } else if (component) {
      const normalizePath = normalizeViewPath(component);
      const pageKey = normalizePath.endsWith('.vue')
        ? normalizePath
        : `${normalizePath}.vue`;
      // 菜单组件标识可能因后台种子更新或人工维护暂时落后；页面路由本身
      // 仍是稳定契约，按 route.path 再尝试一次，避免已有菜单直接进入 404。
      const routePath = route.path ? normalizeViewPath(route.path) : '';
      let routePageKey = '';
      if (routePath) {
        routePageKey = routePath.endsWith('.vue')
          ? routePath
          : `${routePath}.vue`;
      }
      // 目录型菜单通常把 route.path 指向目录，而页面实际落在
      // `index.vue` 或 `list.vue`。旧菜单的 component 可能已经失效，
      // 此时继续按稳定路由路径解析这两个约定，避免把组件设为空值。
      const routePageCandidates = routePageKey
        ? [
            routePageKey,
            routePageKey.replace(/\.vue$/, '/index.vue'),
            routePageKey.replace(/\.vue$/, '/list.vue'),
          ]
        : [];
      const pageComponent = [pageKey, ...routePageCandidates]
        .map((key) => pageMap[key])
        .find(Boolean);
      if (pageComponent) {
        route.component = pageComponent;
      } else {
        console.error(`route component is invalid: ${pageKey}`, route);
        route.component = pageMap['/_core/fallback/not-found.vue'];
      }
    }

    return route;
  });
}

function normalizeViewPath(path: string): string {
  // 去除相对路径前缀
  const normalizedPath = path.replace(/^(\.\/|\.\.\/)+/, '');

  // 共享业务包通过 import.meta.glob 返回的是
  // `packages/.../src/views/<page>.vue`，不能把包目录暴露为路由前缀。
  // 统一从最后一个 `/views/` 开始映射，兼容应用自身和共享包页面。
  const viewsIndex = normalizedPath.lastIndexOf('/views/');
  const viewPath =
    viewsIndex === -1
      ? normalizedPath
      : normalizedPath.slice(viewsIndex + '/views'.length);

  // 确保路径以 '/' 开头
  const routePath = viewPath.startsWith('/') ? viewPath : `/${viewPath}`;

  // 这里耦合了vben-admin的目录结构
  return routePath.replace(/^\/views/, '');
}
export { generateRoutesByBackend };
