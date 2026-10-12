import type { SystemMenu } from '#/api/system/menu';

export interface PermissionGrantTreeNode {
  children?: PermissionGrantTreeNode[];
  disabled?: boolean;
  icon?: string;
  id: string;
  kind: 'api' | 'group' | 'permission';
  apiIds?: string[];
  permissionType?: string;
  label: string;
  method?: string;
  searchText: string;
}

export function buildPermissionGrantTree(
  menus: SystemMenu[],
  apis: readonly { id: number | string; api_code: string }[] = [],
  onlyAssignableApis = false,
): PermissionGrantTreeNode[] {
  const apiCodeById = new Map(
    apis.map((api) => [String(api.id), api.api_code]),
  );
  function build(menus: SystemMenu[]): PermissionGrantTreeNode[] {
    return menus
      .filter((menu) => menu.meta.permission_tree_retired !== true)
      .flatMap<PermissionGrantTreeNode>((menu) => {
        const label = menu.meta.title || menu.name;
        const children = menu.children?.length ? build(menu.children) : [];
        const apiIds = (menu.apiIds ?? []).filter(
          (id) => !onlyAssignableApis || apiCodeById.has(String(id)),
        );
        // 不展示仅关联客户端/已下线接口的功能；不依赖 API 的后台领域权限仍保留。
        if (
          onlyAssignableApis &&
          children.length === 0 &&
          (menu.type === 'catalog' ||
            ((menu.apiIds?.length ?? 0) > 0 && apiIds.length === 0))
        )
          return [];
        return [
          {
            children: children.length > 0 ? children : undefined,
            disabled: menu.status === 0 || menu.type === 'catalog',
            apiIds,
            permissionType: menu.type,
            icon: menu.meta.icon,
            id: String(menu.id),
            kind: 'permission',
            label,
            searchText: [
              label,
              menu.name,
              menu.authCode,
              menu.path,
              menu.type,
              ...apiIds.flatMap((id) => {
                const code = apiCodeById.get(String(id));
                return code ? [`api:${code}`] : [];
              }),
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase(),
          },
        ];
      });
  }
  return build(menus);
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
        // 搜索结果的祖先只用于定位，批量增删不改变其原有授权。
        disabled: node.disabled || !node.searchText.includes(keyword),
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
  function filter(
    nodes: readonly PermissionGrantTreeNode[],
  ): PermissionGrantTreeNode[] {
    return nodes.flatMap((node) => {
      const children = filter(node.children ?? []);
      if (!selected.has(node.id) && children.length === 0) return [];
      return [
        { ...node, children: children.length > 0 ? children : undefined },
      ];
    });
  }
  return filter(nodes);
}

export function selectableGrantIds(nodes: readonly PermissionGrantTreeNode[]) {
  const ids = new Set<string>();
  function visit(nodes: readonly PermissionGrantTreeNode[]) {
    for (const node of nodes) {
      if (!node.disabled) ids.add(node.id);
      visit(node.children ?? []);
    }
  }
  visit(nodes);
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
