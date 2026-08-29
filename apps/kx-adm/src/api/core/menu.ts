import type { RouteRecordStringComponent } from '@vben/types';

import { requestClient } from '#/api/request';

interface PermissionMeta {
  affix_tab?: boolean | null;
  authority?: null | string[];
  badge?: null | string;
  badge_type?: 'dot' | 'normal' | null;
  badge_variants?: null | string;
  icon?: null | string;
  iframe_src?: null | string;
  keep_alive?: boolean | null;
  link?: null | string;
  menu_visible_with_forbidden?: boolean | null;
  order?: null | number;
  resource?: null | string;
  title?: null | string;
}

interface KxPermission {
  auth_code: string;
  component: string;
  enabled: boolean;
  id: number | string;
  meta: PermissionMeta;
  name: string;
  order_no: number;
  path: string;
  perm_type: 'button' | 'catalog' | 'embedded' | 'link' | 'menu';
  pid: number | string;
  redirect?: null | string;
  title: string;
}

function normalizePath(path: string, parent?: string) {
  if (!parent || path.startsWith('/')) return path;
  return path;
}

function toRoute(
  item: KxPermission,
  children: RouteRecordStringComponent[],
): RouteRecordStringComponent {
  const route: any = {
    meta: {
      affixTab: item.meta.affix_tab ?? undefined,
      authority: item.meta.authority ?? undefined,
      badge: item.meta.badge ?? undefined,
      badgeType: item.meta.badge_type ?? undefined,
      badgeVariants: item.meta.badge_variants ?? undefined,
      icon: item.meta.icon ?? undefined,
      iframeSrc: item.meta.iframe_src ?? undefined,
      keepAlive: item.meta.keep_alive ?? undefined,
      link: item.meta.link ?? undefined,
      menuVisibleWithForbidden:
        item.meta.menu_visible_with_forbidden ?? undefined,
      order: item.meta.order ?? item.order_no,
      title: item.meta.title ?? item.title,
    },
    name: item.name,
    path: normalizePath(item.path),
    props: item.meta.resource ? { resource: item.meta.resource } : undefined,
    redirect: item.redirect ?? undefined,
    children: children.length > 0 ? children : undefined,
  };
  if (item.component) route.component = item.component;
  return route as RouteRecordStringComponent;
}

function buildRoutes(items: KxPermission[]) {
  const routeItems = items.filter((item) => item.perm_type !== 'button');
  const childrenMap = new Map<string, KxPermission[]>();
  for (const item of routeItems) {
    const key = String(item.pid);
    childrenMap.set(key, [...(childrenMap.get(key) ?? []), item]);
  }

  const visit = (item: KxPermission): RouteRecordStringComponent => {
    const children = (childrenMap.get(String(item.id)) ?? [])
      .toSorted(
        (a, b) => a.order_no - b.order_no || Number(a.id) - Number(b.id),
      )
      .map((child) => visit(child));
    return toRoute(item, children);
  };

  const itemIds = new Set(routeItems.map((item) => String(item.id)));
  return routeItems
    .filter((item) => !itemIds.has(String(item.pid)))
    .toSorted((a, b) => a.order_no - b.order_no || Number(a.id) - Number(b.id))
    .map((item) => visit(item));
}

export const MenuApi = {
  current: async () =>
    buildRoutes(await requestClient.get<KxPermission[]>('/auth/menu/current')),
};

export { buildRoutes };

/** 获取当前用户菜单。 */
export const getAllMenusApi = MenuApi.current;
