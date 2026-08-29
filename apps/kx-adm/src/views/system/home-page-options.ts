import type { SystemMenu } from '#/api/system/menu';
import type { SystemRole } from '#/api/system/role';

export interface HomePageTreeOption {
  children?: HomePageTreeOption[];
  label: string;
  selectable?: boolean;
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
): HomePageTreeOption[] {
  const allowed = new Set([...permissionIds].map(String));

  function visit(items: SystemMenu[]): HomePageTreeOption[] {
    return items.flatMap((menu) => {
      const children = visit(menu.children ?? []);
      if (allowed.has(menu.id) && isNavigable(menu)) {
        return [
          {
            children: children.length > 0 ? children : undefined,
            label: `${menuTitle(menu)}（${menu.path}）`,
            value: menu.id,
          },
        ];
      }
      if (children.length === 0) return [];
      return [
        {
          children,
          label: menuTitle(menu),
          selectable: false,
          value: `group:${menu.id}`,
        },
      ];
    });
  }

  return visit(menus);
}

export function homePageOptionValues(options: HomePageTreeOption[]) {
  const values = new Set<string>();
  function visit(items: HomePageTreeOption[]) {
    for (const option of items) {
      if (option.selectable !== false) values.add(option.value);
      visit(option.children ?? []);
    }
  }
  visit(options);
  return values;
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
