import type { DownloadUserTreeNode } from '#/api/res/downloads';

export function availableUsers(
  nodes: DownloadUserTreeNode[],
  allowDisabled = false,
): Set<number> {
  return new Set(
    nodes.flatMap((node) => [
      ...(node.selectable && (allowDisabled || !node.disabled)
        ? [Number(node.value)]
        : []),
      ...availableUsers(node.children ?? [], allowDisabled),
    ]),
  );
}

export function applyUserGroup(
  uids: number[],
  tree: DownloadUserTreeNode[],
  allowDisabled = false,
) {
  const available = availableUsers(tree, allowDisabled);
  const unique = [...new Set(uids)];
  const selected = unique.filter((uid) => available.has(uid));
  return { selected, skipped: unique.length - selected.length };
}
