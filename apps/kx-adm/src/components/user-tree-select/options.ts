import type { DownloadUserTreeNode } from '#/api/res/downloads';

// 同一成员可出现于多个公司/部门；TreeSelect 的节点值必须唯一，业务值仍为 UID。
export function userTreeOptions(
  nodes: DownloadUserTreeNode[],
  allowDisabled = false,
  parent = '',
): DownloadUserTreeNode[] {
  return nodes.map((node, index) => {
    const path = `${parent}/${index}`;
    return {
      ...node,
      value: node.selectable
        ? `user:${node.value}:${path}`
        : `${node.value}:${path}`,
      disabled: allowDisabled ? false : node.disabled,
      children: userTreeOptions(node.children ?? [], allowDisabled, path),
    };
  });
}
export function userId(value: string): number | undefined {
  const match = /^user:(\d+):/.exec(value);
  return match ? Number(match[1]) : undefined;
}
export function firstUserValues(
  nodes: DownloadUserTreeNode[],
): Map<number, string> {
  const result = new Map<number, string>();
  const walk = (items: DownloadUserTreeNode[]) => {
    for (const item of items) {
      const uid = userId(item.value);
      if (uid !== undefined && !result.has(uid)) result.set(uid, item.value);
      walk(item.children ?? []);
    }
  };
  walk(nodes);
  return result;
}
