import type { SystemDept } from '#/api';

export function collectDeptIdsIncludingDescendants(
  depts: SystemDept[],
  selectedId: number | string | undefined,
): string[] {
  const rootId = normalizeId(selectedId);
  if (!rootId) return [];
  const result: string[] = [];

  function visit(nodes: SystemDept[]) {
    for (const node of nodes) {
      const id = normalizeId(node.id);
      if (id === rootId) {
        collect(node);
        return true;
      }
      if (node.children?.length && visit(node.children)) {
        return true;
      }
    }
    return false;
  }

  function collect(node: SystemDept) {
    const id = normalizeId(node.id);
    if (id) result.push(id);
    for (const child of node.children ?? []) {
      collect(child);
    }
  }

  visit(depts);
  return result;
}

function normalizeId(value: number | string | undefined) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}
