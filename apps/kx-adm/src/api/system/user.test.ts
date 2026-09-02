import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SystemUserApi } from '#/api/system/user';

const { get, put } = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
}));

vi.mock('#/api/request', () => ({
  requestClient: { get, put },
}));

const user = {
  api_ids: [21],
  avatar: '',
  created_at: 1_788_000_000,
  dept_id: 0,
  email: '',
  enabled: true,
  home_perm_id: null,
  id: 42,
  is_guest: false,
  name: '测试用户',
  os: '',
  permission_ids: [11],
  platform: '',
  reg_ip: '',
  remark: null,
  role_ids: ['msg_readonly'],
  tel: '',
  updated_at: 1_788_000_000,
};

describe('systemUserApi', () => {
  beforeEach(() => {
    get.mockReset();
    put.mockReset();
  });

  it('编辑用户时不提交表单残留的初始密码', async () => {
    get.mockResolvedValueOnce(user);
    put.mockResolvedValueOnce(user);

    await SystemUserApi.update('42', {
      name: '测试用户',
      password: 'Initial-Password-Should-Not-Be-Sent',
    });

    expect(put).toHaveBeenCalledWith(
      '/auth/user-admin/42',
      expect.objectContaining({ password: '' }),
    );
  });
});
