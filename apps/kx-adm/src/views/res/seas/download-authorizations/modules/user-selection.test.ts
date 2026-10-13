import type { DownloadUserTreeNode } from '#/api/res/downloads';

import { expect, it } from 'vitest';

import { applyUserGroup } from './user-selection';
const user = (id: number, disabled = false): DownloadUserTreeNode => ({
  value: String(id),
  title: String(id),
  selectable: true,
  disabled,
  children: [],
});
it('快速组只恢复当前可授权成员，去重并报告失效项', () => {
  expect(
    applyUserGroup([7, 8, 9, 7], [user(7), user(8, true), user(7)]),
  ).toEqual({ selected: [7], skipped: 2 });
  expect(applyUserGroup([7, 8, 9], [user(7), user(8, true)], true)).toEqual({
    selected: [7, 8],
    skipped: 1,
  });
});
