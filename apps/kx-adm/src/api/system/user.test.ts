import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SystemUserApi } from '#/api/system/user';

const { download, get, put } = vi.hoisted(() => ({
  download: vi.fn(),
  get: vi.fn(),
  put: vi.fn(),
}));

vi.mock('#/api/request', () => ({
  plaintextRequestClient: { download },
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
    download.mockReset();
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

  it('周报模板通过明文二进制客户端下载', async () => {
    const blob = new Blob(['xlsx']);
    download.mockResolvedValueOnce(blob);
    const request = {
      current_week_end: '2026-09-05',
      current_week_start: '2026-08-31',
      dept_id: 1,
      next_week_end: '2026-09-12',
      next_week_start: '2026-09-07',
      report_date: '2026-09-03',
      reporter: '测试用户',
      week_no: 1,
    };

    await expect(SystemUserApi.weekly_report_template(request)).resolves.toBe(
      blob,
    );
    expect(download).toHaveBeenCalledWith(
      '/auth/user-admin/actions/weekly-report-template',
      { data: request, method: 'POST' },
    );
  });
});
