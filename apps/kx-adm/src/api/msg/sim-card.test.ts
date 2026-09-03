import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SimCardApi } from './sim-card';

const { download, post, upload } = vi.hoisted(() => ({
  download: vi.fn(),
  post: vi.fn(),
  upload: vi.fn(),
}));

vi.mock('#/api/request', () => ({
  plaintextRequestClient: { download, upload },
  requestClient: { post },
}));

describe('simCardApi', () => {
  beforeEach(() => {
    download.mockReset();
    post.mockReset();
    upload.mockReset();
  });

  it('实名导入文件接口使用明文二进制客户端', async () => {
    const file = new File(['phone,real_name'], 'names.csv');
    upload.mockResolvedValueOnce({ id: 7 });
    download.mockResolvedValue(new Blob(['xlsx']));

    await SimCardApi.createRealNameImport(file);
    await SimCardApi.realNameImportTemplate();
    await SimCardApi.realNameImportResult(7);

    expect(upload).toHaveBeenCalledWith('/msg/sim-cards/real-name-imports', {
      file,
    });
    expect(download).toHaveBeenNthCalledWith(
      1,
      '/msg/sim-cards/real-name-imports/template',
    );
    expect(download).toHaveBeenNthCalledWith(
      2,
      '/msg/sim-cards/real-name-imports/7/result',
    );
  });

  it('单卡发送短信只在 path 传 ICCID', async () => {
    post.mockResolvedValueOnce({ job_key: 'job-1' });
    const payload = {
      content: '测试',
      idempotency_key: 'send-1',
      target_number: '13800000000',
    };

    await SimCardApi.sendSms('898600123', payload);

    expect(post).toHaveBeenCalledWith('/msg/sim-cards/898600123/sms', payload);
  });
});
