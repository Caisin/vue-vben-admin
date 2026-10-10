import type { ClientRelease } from './client-releases';

import { expect, it, vi } from 'vitest';

import { ClientReleaseApi } from './client-releases';

const request = vi.hoisted(() => ({
  put: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}));
vi.mock('#/api/request', () => ({ requestClient: request }));
it('发布、撤回、编辑和删除均定位版本与平台', async () => {
  const row: ClientRelease = {
    version: '1.0.0',
    target: 'windows-x86_64',
    notes: '',
    artifacts: [
      { target: 'windows-x86_64', url: '', signature: 'signed', file_id: '42' },
    ],
    revision: 3,
    status: 'draft',
    created_at: 1,
    updated_at: 1,
    published_at: null,
  };
  await ClientReleaseApi.action(row, 'publish');
  await ClientReleaseApi.action(row, 'withdraw');
  await ClientReleaseApi.edit(row, row);
  await ClientReleaseApi.remove(row);
  expect(request.post).toHaveBeenCalledWith(
    '/adm/client-releases/1.0.0/windows-x86_64/publish',
    { expected_revision: 3 },
  );
  expect(request.post).toHaveBeenCalledWith(
    '/adm/client-releases/1.0.0/windows-x86_64/withdraw',
    { expected_revision: 3 },
  );
  expect(request.put).toHaveBeenCalledWith(
    '/adm/client-releases/1.0.0/windows-x86_64',
    expect.objectContaining({ expected_revision: 3 }),
  );
  expect(request.delete).toHaveBeenCalledWith(
    '/adm/client-releases/1.0.0/windows-x86_64',
    { data: { expected_revision: 3 } },
  );
});
