import { afterEach, expect, it, vi } from 'vitest';

import { episodeHistoryApi } from './episode-history';
const calls = vi.hoisted(() => ({
  get: vi.fn(),
  download: vi.fn(),
  post: vi.fn(),
}));
vi.mock('#/api/request', () => ({
  requestClient: { get: calls.get, post: calls.post },
  plaintextRequestClient: { download: calls.download },
}));
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
it('历史视频使用独立历史ID授权地址，不读取当前视频', async () => {
  calls.get.mockResolvedValue('/storage/file/content/99');
  const blob = new Blob(['history']);
  calls.download.mockResolvedValue(blob);
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:history');
  expect(await episodeHistoryApi.play(1, 2, 3, 4)).toBe('blob:history');
  expect(calls.get).toHaveBeenCalledWith(
    '/adm/res/review/1/2/episodes/3/history/4/play',
  );
  expect(calls.download).toHaveBeenCalledWith(
    '/adm/res/review/1/2/episodes/3/history/4/content',
  );
});
it('签名历史地址直接播放且拒绝授权时不下载文件', async () => {
  calls.get.mockResolvedValue('https://media.example.test/history.mp4');
  expect(await episodeHistoryApi.play(1, 2, 3, 4)).toBe(
    'https://media.example.test/history.mp4',
  );
  expect(calls.download).not.toHaveBeenCalled();
  calls.get.mockRejectedValue(new Error('历史归属无效'));
  await expect(episodeHistoryApi.play(1, 2, 3, 9)).rejects.toThrow('归属');
  expect(calls.download).not.toHaveBeenCalled();
});
it('恢复只提交历史定位、原修订号和原因，不能注入视频引用', async () => {
  calls.post.mockResolvedValue(undefined);
  await episodeHistoryApi.restore(1, 2, 3, 4, 8, '回退调色');
  expect(calls.post).toHaveBeenCalledWith(
    '/adm/res/review/1/2/episodes/3/history/4/restore',
    { expected_revision: 8, reason: '回退调色' },
  );
});
