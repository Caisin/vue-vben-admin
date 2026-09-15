import type { SystemDept } from '#/api/system/dept';

export interface DepartmentRow extends SystemDept {
  children: DepartmentRow[];
  isCompany?: boolean;
}

// 公司接口提供归属，部门接口提供可维护的真实字段；公司虚拟ID不参与写入。
export function buildCompanyDepartmentTree(
  companies: SystemDept[],
  departments: SystemDept[],
): DepartmentRow[] {
  const membership = new Map<string, string>();
  const groups = new Map<string, DepartmentRow>();
  function assign(nodes: SystemDept[], source: string) {
    for (const node of nodes) {
      membership.set(node.id, source);
      assign(node.children ?? [], source);
    }
  }
  for (const company of companies) {
    if (!company.sourceId) continue;
    groups.set(company.sourceId, {
      ...company,
      id: `company:${company.sourceId}`,
      isCompany: true,
      children: [],
    });
    assign(company.children ?? [], company.sourceId);
  }
  const rows = new Map<string, DepartmentRow>();
  function collect(nodes: SystemDept[], inherited?: string) {
    for (const node of nodes) {
      const source = membership.get(node.id) ?? inherited;
      if (source) membership.set(node.id, source);
      rows.set(node.id, { ...node, children: [] });
      collect(node.children ?? [], source);
    }
  }
  collect(departments);
  const local: DepartmentRow = {
    id: 'company:local',
    name: '未关联公司的部门',
    status: 1,
    isCompany: true,
    children: [],
  };
  for (const row of rows.values()) {
    const source = membership.get(row.id);
    const parent = row.pid ? rows.get(row.pid) : undefined;
    if (parent && membership.get(parent.id) === source) {
      parent.children.push(row);
    } else {
      (groups.get(source ?? '') ?? local).children.push(row);
    }
  }
  return [...groups.values(), ...(local.children.length > 0 ? [local] : [])];
}
