import type { RawDepartment } from '#/api/system/dingtalk-directory';
export interface OrganizationOption {
  value: string;
  title: string;
  children: OrganizationOption[];
}
export function organizationOptions(
  rows: RawDepartment[],
): OrganizationOption[] {
  const nodes = new Map(
    rows
      .filter((r) => r.active)
      .map((r) => [
        r.id,
        { value: r.id, title: r.name, children: [] as OrganizationOption[] },
      ]),
  );
  const parent = new Map(rows.map((r) => [r.id, r.parent_id]));
  const roots: OrganizationOption[] = [];
  for (const [id, node] of nodes) {
    const visited = new Set([id]);
    let ancestor = parent.get(id);
    let cyclic = false;
    while (ancestor && nodes.has(ancestor)) {
      if (visited.has(ancestor)) {
        cyclic = true;
        break;
      }
      visited.add(ancestor);
      ancestor = parent.get(ancestor);
    }
    const target = nodes.get(parent.get(id) ?? '');
    if (target && !cyclic) target.children.push(node);
    else roots.push(node);
  }
  return roots;
}
export function attendanceLabel(value: string) {
  const labels: Record<string, string> = {
    OnDuty: '上班',
    OffDuty: '下班',
    Normal: '正常',
    Early: '早退',
    Late: '迟到',
    SeriousLate: '严重迟到',
    Absenteeism: '旷工迟到',
    NotSigned: '未打卡',
    Outside: '范围外',
  };
  return labels[value] ?? value;
}
export function attendanceTime(value?: number) {
  return value
    ? new Date(Number(value)).toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        hour12: false,
      })
    : '—';
}
