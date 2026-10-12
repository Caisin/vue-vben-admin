import { describe, expect, it } from 'vitest';

import { resourceCapabilities } from './access';

describe('资源按钮独立授权', () => {
  it.each([
    ['api:res.admin.res.version_resource.create', 'create'],
    ['api:res.admin.res.versions.create', 'createVersion'],
    ['api:res.admin.res.versions.update', 'updateVersion'],
    ['api:res.admin.res.versions.delete', 'deleteVersion'],
    ['api:res.admin.res.versions.items.create', 'createItem'],
    ['api:res.admin.res.versions.items.update', 'updateItem'],
    ['api:res.admin.res.versions.items.delete', 'deleteItem'],
    ['api:res.admin.res.video_import.submit', 'importVideo'],
    ['api:res.admin.res.novel_import.submit', 'importNovel'],
    ['api:res.admin.res.download_permissions.get', 'authorize'],
    ['res:content:download', 'download'],
  ])('%s 只开放对应入口', (code, key) => {
    const result = resourceCapabilities((codes) => codes.includes(code));
    expect(
      Object.entries(result)
        .filter(([, value]) => value)
        .map(([name]) => name),
    ).toEqual([key]);
  });
  it('历史领域管理身份不隐式授予 API 操作', () => {
    expect(
      Object.values(
        resourceCapabilities((codes) => codes.includes('res:content:manage')),
      ).every((value) => !value),
    ).toBe(true);
  });
});
