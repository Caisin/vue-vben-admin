import type { SystemMenu } from '#/api/system/menu';
import type { SystemRole } from '#/api/system/role';

export interface HomePageOption {
  label: string;
  value: string;
}

function menuTitle(menu: SystemMenu) {
  return typeof menu.meta.title === 'string' && menu.meta.title
    ? menu.meta.title
    : menu.name;
}

function isNavigable(menu: SystemMenu) {
  return (
    menu.status === 1 &&
    (menu.type === 'menu' || menu.type === 'embedded') &&
    menu.path.startsWith('/') &&
    !menu.path.startsWith('//')
  );
}

export function homePageOptions(
  menus: SystemMenu[],
  permissionIds: Iterable<number | string>,
): HomePageOption[] {
  const allowed = new Set([...permissionIds].map(String));
  const options: HomePageOption[] = [];

  function visit(items: SystemMenu[], parents: string[]) {
    for (const menu of items) {
      const titles = [...parents, menuTitle(menu)];
      if (allowed.has(menu.id) && isNavigable(menu)) {
        options.push({
          label: `${titles.join(' / ')}（${menu.path}）`,
          value: menu.id,
        });
      }
      visit(menu.children ?? [], titles);
    }
  }

  visit(menus, []);
  return options;
}

export function userEffectivePermissionIds(
  directPermissionIds: Iterable<number | string>,
  selectedRoleIds: Iterable<string>,
  roles: SystemRole[],
) {
  const permissionIds = new Set([...directPermissionIds].map(String));
  const roleIds = new Set(selectedRoleIds);

  for (const role of roles) {
    if (role.status !== 1 || !roleIds.has(role.id)) continue;
    for (const permissionId of role.permissions) {
      permissionIds.add(String(permissionId));
    }
  }

  return permissionIds;
}
