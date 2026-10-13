import type { DownloadUserTreeNode } from '#/api/res/downloads';

import { expect, it } from 'vitest';

import { firstUserValues, userId, userTreeOptions } from './options';
const member: DownloadUserTreeNode = {
  value: '7',
  title: '张三',
  selectable: true,
  disabled: true,
  children: [],
};
it('同一用户跨部门出现时节点值唯一，提交身份不变', () => {
  const nodes = userTreeOptions([
    member,
    {
      value: 'dept:1',
      title: '部门',
      selectable: false,
      disabled: false,
      children: [member],
    },
  ]);
  const first = nodes[0];
  const second = nodes[1]?.children[0];
  if (!first || !second) throw new Error('缺少测试节点');
  expect(first.value).not.toBe(second.value);
  expect(userId(first.value)).toBe(7);
  expect(userId(second.value)).toBe(7);
  expect([...firstUserValues(nodes).keys()]).toEqual([7]);
  expect(userId(nodes[1]?.value ?? '')).toBeUndefined();
  expect(first.disabled).toBe(true);
  expect(userTreeOptions([member], true)[0]?.disabled).toBe(false);
});
