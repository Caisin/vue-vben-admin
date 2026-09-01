import type { ApiPermission } from '#/api/system/api-permission';
import type { SystemMenu } from '#/api/system/menu';

export interface PermissionGrantTreeNode {
  children?: PermissionGrantTreeNode[];
  disabled?: boolean;
  icon?: string;
  id: string;
  kind: 'api' | 'group' | 'permission';
  label: string;
  method?: string;
  searchText: string;
}

export function buildPermissionGrantTree(
  menus: SystemMenu[],
): PermissionGrantTreeNode[] {
  return menus.map((menu) => {
    const label = menu.meta.title || menu.name;
    return {
      children: menu.children?.length
        ? buildPermissionGrantTree(menu.children)
        : undefined,
      disabled: menu.status === 0,
      icon: menu.meta.icon,
      id: String(menu.id),
      kind: 'permission',
      label,
      searchText: [label, menu.name, menu.authCode, menu.path, menu.type]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    };
  });
}

export function buildUnboundApiGrantTree(
  apis: ApiPermission[],
): PermissionGrantTreeNode[] {
  return buildApiGrantTree(apis, { includeBound: false });
}

export function buildApiGrantTree(
  apis: ApiPermission[],
  options: { includeBound?: boolean } = {},
): PermissionGrantTreeNode[] {
  const groups = new Map<string, PermissionGrantTreeNode[]>();
  for (const api of apis) {
    if (
      !api.enabled ||
      api.auth_exempt ||
      (!options.includeBound && Number(api.menu_perm_id) !== 0)
    ) {
      continue;
    }
    const group = api.api_path.split('/').find(Boolean) || 'other';
    const label = api.api_name || api.api_path;
    const nodes = groups.get(group) ?? [];
    nodes.push({
      id: String(api.id),
      kind: 'api',
      label,
      method: api.api_method,
      searchText: [
        label,
        api.api_method,
        api.api_path,
        api.api_code,
        api.access_mode,
      ]
        .join(' ')
        .toLowerCase(),
    });
    groups.set(group, nodes);
  }

  return [...groups.entries()]
    .toSorted(([left], [right]) => left.localeCompare(right))
    .map(([group, children]) => ({
      children: children.toSorted((left, right) =>
        `${left.method} ${left.label}`.localeCompare(
          `${right.method} ${right.label}`,
        ),
      ),
      disabled: true,
      id: `api-group:${group}`,
      kind: 'group',
      label: `/${group}`,
      searchText: group.toLowerCase(),
    }));
}

export function filterPermissionGrantTree(
  nodes: PermissionGrantTreeNode[],
  input: string,
): PermissionGrantTreeNode[] {
  const keyword = input.trim().toLowerCase();
  if (!keyword) return nodes;

  const filtered: PermissionGrantTreeNode[] = [];
  for (const node of nodes) {
    const children = filterPermissionGrantTree(node.children ?? [], keyword);
    if (node.searchText.includes(keyword) || children.length > 0) {
      filtered.push({
        ...node,
        children: children.length > 0 ? children : undefined,
      });
    }
  }
  return filtered;
}

export function filterGrantTreeByIds(
  nodes: readonly PermissionGrantTreeNode[],
  selectedIds: Iterable<number | string>,
): PermissionGrantTreeNode[] {
  const selected = new Set([...selectedIds].map(String));
  return nodes.flatMap((node) => {
    const children = filterGrantTreeByIds(node.children ?? [], selected);
    if (!selected.has(node.id) && children.length === 0) return [];
    return [{ ...node, children: children.length > 0 ? children : undefined }];
  });
}

export function selectableGrantIds(nodes: readonly PermissionGrantTreeNode[]) {
  const ids = new Set<string>();
  for (const node of nodes) {
    if (!node.disabled) ids.add(node.id);
    for (const id of selectableGrantIds(node.children ?? [])) ids.add(id);
  }
  return ids;
}

export function mergeVisibleGrantSelection(
  selected: string[],
  next: Array<number | string>,
  visibleNodes: readonly PermissionGrantTreeNode[],
) {
  const visibleIds = selectableGrantIds(visibleNodes);
  const hidden = selected.filter((id) => !visibleIds.has(String(id)));
  return [...new Set([...hidden, ...next.map(String)])];
}
