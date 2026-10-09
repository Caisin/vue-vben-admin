import { afterEach, expect, it, vi } from 'vitest';

import { uploadDesktopRelease } from './release-upload';

const state = vi.hoisted(() => ({
  invoke: vi.fn(),
  listen: vi.fn(),
  off: vi.fn(),
}));
vi.mock('@tauri-apps/api/core', () => ({ invoke: state.invoke }));
vi.mock('@tauri-apps/api/event', () => ({ listen: state.listen }));
afterEach(() => vi.resetAllMocks());

it('原生选择取消后清理进度监听', async () => {
  state.listen.mockResolvedValue(state.off);
  state.invoke.mockResolvedValue(null);
  expect(
    await uploadDesktopRelease(
      's3',
      { version: '', notes: '', artifacts: [] },
      vi.fn(),
    ),
  ).toBeNull();
  expect(state.invoke).toHaveBeenCalledWith(
    'desktop_release_upload',
    expect.objectContaining({
      storageCode: 's3',
      expectedVersion: null,
      existingTargets: [],
    }),
  );
  expect(state.off).toHaveBeenCalledOnce();
});

it('只接收本次上传的进度，失败也释放监听', async () => {
  const progress = vi.fn();
  let receive: (event: { payload: Record<string, unknown> }) => void = () => {};
  state.listen.mockImplementation(async (_event, listener) => {
    receive = listener;
    return state.off;
  });
  state.invoke.mockImplementation(async (_command, options) => {
    receive({
      payload: { id: 'other', stage: 'uploading', bytes: 1, total: 2 },
    });
    receive({
      payload: { id: options.id, stage: 'uploading', bytes: 2, total: 3 },
    });
    throw new Error('网络中断');
  });
  await expect(
    uploadDesktopRelease(
      's3',
      { version: '1.0.0', notes: '', artifacts: [] },
      progress,
    ),
  ).rejects.toThrow('网络中断');
  expect(progress).toHaveBeenCalledTimes(1);
  expect(progress).toHaveBeenCalledWith(
    expect.objectContaining({ bytes: 2, total: 3 }),
  );
  expect(state.off).toHaveBeenCalledOnce();
});
