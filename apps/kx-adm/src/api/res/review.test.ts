import { afterEach, expect, it, vi } from 'vitest';

import { reviewApi } from './review';
const calls = vi.hoisted(() => ({ get: vi.fn(), download: vi.fn() }));
vi.mock('#/api/request', () => ({
  requestClient: { get: calls.get },
  plaintextRequestClient: { download: calls.download },
}));
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
it('签名对象地址直接交给播放器，不通过后台下载携带令牌', async () => {
  calls.get.mockResolvedValue(
    'https://media.example.test/1.mp4?signature=test',
  );
  expect(await reviewApi.play(1, 10, 2)).toBe(
    'https://media.example.test/1.mp4?signature=test',
  );
  expect(calls.download).not.toHaveBeenCalled();
});
it('本地私有视频通过作品范围接口读取，不请求全局文件接口', async () => {
  calls.get.mockResolvedValue('/storage/file/content/90');
  const blob = new Blob(['video'], { type: 'video/mp4' });
  calls.download.mockResolvedValue(blob);
  const create = vi
    .spyOn(URL, 'createObjectURL')
    .mockReturnValue('blob:review-90');
  expect(await reviewApi.play(1, 10, 2)).toBe('blob:review-90');
  expect(calls.download).toHaveBeenCalledWith(
    '/adm/res/review/1/10/play/2/content',
  );
  expect(create).toHaveBeenCalledWith(blob);
});
it('作品预览被拒绝时，不尝试绕过权限读取文件', async () => {
  calls.get.mockRejectedValue(new Error('你不是此作品的协作者'));
  await expect(reviewApi.play(1, 10, 2)).rejects.toThrow('协作者');
  expect(calls.download).not.toHaveBeenCalled();
});
