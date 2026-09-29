import { describe, expect, it } from 'vitest';

import { resourceCapabilities } from './access';
describe('资源操作权限', () => {
  it.each([
    [
      'res:content:download',
      { manage: false, upload: false, download: true, authorize: false },
    ],
    [
      'res:download:authorize',
      { manage: false, upload: false, download: false, authorize: true },
    ],
    [
      'res:content:upload',
      { manage: false, upload: true, download: false, authorize: false },
    ],
    [
      'res:content:manage',
      { manage: true, upload: true, download: true, authorize: true },
    ],
  ] as const)('%s 只显示对应工作流', (code, expected) => {
    expect(resourceCapabilities((codes) => codes.includes(code))).toEqual(
      expected,
    );
  });
  it('没有按钮权限时只保留查询', () => {
    expect(resourceCapabilities(() => false)).toEqual({
      manage: false,
      upload: false,
      download: false,
      authorize: false,
    });
  });
});
