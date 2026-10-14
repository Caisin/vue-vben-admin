import type { RawDepartment } from '#/api/system/dingtalk-directory';

import { expect, it } from 'vitest';

import {
  attendanceLabel,
  attendanceTime,
  organizationOptions,
} from './organization';
const dept = (id: string, parent_id: string, active = true): RawDepartment => ({
  id,
  parent_id,
  name: `部门${id}`,
  active,
  synced_at: 1,
  raw: {},
});
it('保留原始部门关系，失效父部门和循环不会丢节点或递归爆栈', () => {
  const tree = organizationOptions([
    dept('1', '0'),
    dept('2', '1'),
    dept('3', '9'),
    dept('9', '0', false),
    dept('4', '5'),
    dept('5', '4'),
  ]);
  expect(tree.map((n) => n.value)).toEqual(['1', '3', '4', '5']);
  expect(tree[0]?.children[0]?.value).toBe('2');
});
it('考勤显示使用北京时间并保留未知钉钉结果', () => {
  expect(attendanceLabel('NotSigned')).toBe('未打卡');
  expect(attendanceLabel('new-code')).toBe('new-code');
  expect(attendanceTime(0)).toBe('—');
  expect(attendanceTime(1_791_849_600_000)).toContain('8:00:00');
});
