import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SimCardApi } from './sim-card';

const { download, upload } = vi.hoisted(() => ({
  download: vi.fn(),
  upload: vi.fn(),
}));

vi.mock('#/api/request', () => ({
  plaintextRequestClient: { download, upload },
  requestClient: {},
}));

describe('simCardApi', () => {
  beforeEach(() => {
    download.mockReset();
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
});
