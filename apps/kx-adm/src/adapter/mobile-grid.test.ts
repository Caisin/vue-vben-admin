import { describe, expect, it } from 'vitest';

import { mobileGridColumns } from './mobile-grid';

describe('手机表格列', () => {
  it('取消分组、选择和操作列固定，保留原配置和业务插槽', () => {
    const columns = [
      { type: 'checkbox' as const, fixed: 'left' as const, width: 48 },
      {
        title: '账号',
        fixed: 'left' as const,
        children: [{ field: 'name', fixed: 'left' as const }],
      },
      {
        field: 'actions',
        fixed: 'right' as const,
        slots: { default: 'actions' },
        width: 180,
      },
    ];
    const mobile = mobileGridColumns(columns);
    expect(mobile?.map((c) => c?.fixed)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(mobile?.[1]?.children?.[0]?.fixed).toBeUndefined();
    expect(mobile?.[0]?.type).toBe('checkbox');
    expect(mobile?.[2]?.slots).toEqual({ default: 'actions' });
    expect(mobile?.[2]?.width).toBe(180);
    expect(columns[0]?.fixed).toBe('left');
    expect(columns[2]?.fixed).toBe('right');
  });

  it('允许没有声明列的表格与后续动态列', () => {
    expect(mobileGridColumns(undefined)).toBeUndefined();
    expect(
      mobileGridColumns([{ field: 'created_at', fixed: 'right' }])?.[0]?.field,
    ).toBe('created_at');
  });
});
