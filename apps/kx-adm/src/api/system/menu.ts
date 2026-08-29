import type { StatusValue } from './shared';

import type {
  AdminPermission,
  AdminPermissionWrite,
  PermissionMeta,
  PermissionType,
} from '#/api/auth/admin';
import type { JsonValue } from '#/api/request';

import { requestClient } from '#/api/request';

import { enabledFromStatus, statusFromEnabled } from './shared';

export const SystemMenuBadgeVariants = [
  'default',
  'destructive',
  'primary',
  'success',
  'warning',
] as const;
export const SystemMenuBadgeTypes = ['dot', 'normal'] as const;
export const SystemMenuTypes = [
  'catalog',
  'menu',
  'embedded',
  'link',
  'button',
] as const;

export interface SystemMenuMeta extends Record<string, JsonValue | undefined> {
  activeIcon?: string;
  activePath?: string;
  affixTab?: boolean;
  affixTabOrder?: number;
  badge?: string;
  badgeType?: (typeof SystemMenuBadgeTypes)[number];
  badgeVariants?: (typeof SystemMenuBadgeVariants)[number];
  hideChildrenInMenu?: boolean;
  hideInBreadcrumb?: boolean;
  hideInMenu?: boolean;
  hideInTab?: boolean;
  icon?: string;
  iframeSrc?: string;
  keepAlive?: boolean;
  link?: string;
  maxNumOfOpenTab?: number;
  menuVisibleWithForbidden?: boolean;
  noBasicLayout?: boolean;
  openInNewWindow?: boolean;
  order?: number;
  query?: Record<string, JsonValue>;
  resource?: string;
  title?: string;
}

export interface SystemMenu {
  authCode: string;
  children?: SystemMenu[];
  component?: string;
  id: string;
  meta: SystemMenuMeta;
  name: string;
  path: string;
  pid: string;
  redirect?: null | string;
  status: StatusValue;
  type: (typeof SystemMenuTypes)[number];
}

export type SystemMenuWrite = Omit<SystemMenu, 'children' | 'id'>;

function camelMeta(meta: null | PermissionMeta | undefined): SystemMenuMeta {
  const source = (meta ?? {}) as Record<string, JsonValue | undefined>;
  return {
    ...source,
    activeIcon: source.active_icon as string | undefined,
    activePath: source.active_path as string | undefined,
    affixTab: meta?.affix_tab,
    affixTabOrder: source.affix_tab_order as number | undefined,
    badge: meta?.badge,
    badgeType: meta?.badge_type as SystemMenuMeta['badgeType'],
    badgeVariants: meta?.badge_variants as SystemMenuMeta['badgeVariants'],
    hideChildrenInMenu: source.hide_children_in_menu as boolean | undefined,
    hideInBreadcrumb: source.hide_in_breadcrumb as boolean | undefined,
    hideInMenu: source.hide_in_menu as boolean | undefined,
    hideInTab: source.hide_in_tab as boolean | undefined,
    icon: meta?.icon,
    iframeSrc: meta?.iframe_src,
    keepAlive: meta?.keep_alive,
    link: meta?.link,
    maxNumOfOpenTab: source.max_num_of_open_tab as number | undefined,
    menuVisibleWithForbidden: meta?.menu_visible_with_forbidden,
    noBasicLayout: source.no_basic_layout as boolean | undefined,
    openInNewWindow: source.open_in_new_window as boolean | undefined,
    order: meta?.order,
    query: source.query as Record<string, JsonValue> | undefined,
    resource: typeof meta?.resource === 'string' ? meta.resource : undefined,
    title: meta?.title ?? undefined,
  };
}

function snakeMeta(meta: SystemMenuMeta = {}): PermissionMeta {
  const source = meta as Record<string, JsonValue | undefined>;
  return {
    ...source,
    active_icon: meta.activeIcon,
    active_path: meta.activePath,
    affix_tab: meta.affixTab,
    affix_tab_order: meta.affixTabOrder,
    badge: meta.badge,
    badge_type: meta.badgeType,
    badge_variants: meta.badgeVariants,
    hide_children_in_menu: meta.hideChildrenInMenu,
    hide_in_breadcrumb: meta.hideInBreadcrumb,
    hide_in_menu: meta.hideInMenu,
    hide_in_tab: meta.hideInTab,
    icon: meta.icon,
    iframe_src: meta.iframeSrc,
    keep_alive: meta.keepAlive,
    link: meta.link,
    max_num_of_open_tab: meta.maxNumOfOpenTab,
    menu_visible_with_forbidden: meta.menuVisibleWithForbidden,
    no_basic_layout: meta.noBasicLayout,
    open_in_new_window: meta.openInNewWindow,
    order: meta.order,
    query: meta.query,
    resource: typeof meta.resource === 'string' ? meta.resource : undefined,
    title: meta.title,
  } as PermissionMeta;
}

function toSystemMenu(permission: AdminPermission): SystemMenu {
  return {
    authCode: permission.auth_code,
    component: permission.component,
    id: String(permission.id),
    meta: camelMeta(permission.meta),
    name: permission.name,
    path: permission.path,
    pid: String(permission.pid),
    redirect: permission.redirect,
    status: statusFromEnabled(permission.enabled),
    type: permission.perm_type,
  };
}

function toPermissionWrite(menu: SystemMenuWrite): AdminPermissionWrite {
  const meta = snakeMeta(menu.meta);
  return {
    auth_code: menu.authCode ?? '',
    component: menu.component ?? '',
    enabled: enabledFromStatus(menu.status),
    meta,
    name: menu.name,
    order_no: meta.order ?? 0,
    path: menu.path || '/',
    perm_type: menu.type as PermissionType,
    pid: menu.pid ? Number(menu.pid) : 0,
    redirect: menu.redirect,
    remark: null,
    title: meta.title ?? menu.name,
  };
}

function toTree(items: SystemMenu[]): SystemMenu[] {
  const nodeById = new Map<string, SystemMenu>();
  const roots: SystemMenu[] = [];
  for (const item of items) {
    nodeById.set(item.id, { ...item, children: undefined });
  }
  for (const item of items) {
    const node = nodeById.get(item.id);
    if (!node) continue;
    const parent = nodeById.get(item.pid);
    if (!parent || item.pid === '0') {
      roots.push(node);
    } else {
      parent.children ??= [];
      parent.children.push(node);
    }
  }
  return roots;
}

export const SystemMenuApi = {
  BadgeTypes: SystemMenuBadgeTypes,
  BadgeVariants: SystemMenuBadgeVariants,
  MenuTypes: SystemMenuTypes,
  async list() {
    const response = await requestClient.get<
      AdminPermission[] | { items?: AdminPermission[] }
    >('/auth/menu/all');
    const permissions = Array.isArray(response)
      ? response
      : (response.items ?? []);
    return toTree(permissions.map((permission) => toSystemMenu(permission)));
  },
  nameExists: (name: string, id?: string) =>
    requestClient.get<boolean>('/auth/menu/name_exists', {
      params: { exclude_id: id, value: name },
    }),
  pathExists: (path: string, id?: string) =>
    requestClient.get<boolean>('/auth/menu/path_exists', {
      params: { exclude_id: id, value: path },
    }),
  async create(data: SystemMenuWrite) {
    const permission = await requestClient.post<AdminPermission>(
      '/auth/menu',
      toPermissionWrite(data),
    );
    return toSystemMenu(permission);
  },
  async update(id: string, data: SystemMenuWrite) {
    const permission = await requestClient.put<AdminPermission>(
      `/auth/menu/${id}`,
      toPermissionWrite(data),
    );
    return toSystemMenu(permission);
  },
  remove: (id: string, cascade = false) =>
    requestClient.delete<boolean>(`/auth/menu/${id}`, {
      params: { cascade },
    }),
};
