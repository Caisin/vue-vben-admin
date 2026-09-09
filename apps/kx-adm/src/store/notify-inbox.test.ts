import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useNotifyInboxStore } from './notify-inbox';

const { list, clear } = vi.hoisted(() => ({ list: vi.fn(), clear: vi.fn() }));
vi.mock('#/api/notify', () => ({ NotifyInboxApi: { list, clear } }));
const oldInbox = {
  items: [
    {
      source_type: 'task_run',
      source_id: 1,
      title: '旧任务',
      content: '',
      status: 'running',
      event_at: 1,
      read: false,
    },
  ],
  unread_count: 1,
  server_time: 1,
};
const emptyInbox = { items: [], unread_count: 0, server_time: 2 };

describe('通知收件箱请求顺序', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    list.mockReset();
    clear.mockReset();
  });
  it('清空后旧轮询响应不能重新填回通知', async () => {
    const store = useNotifyInboxStore();
    let resolveOld: (value: typeof oldInbox) => void = () => {};
    list
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
      )
      .mockResolvedValueOnce(emptyInbox);
    clear.mockResolvedValue({ changed: true, updated_at: 2 });
    const pending = store.load();
    await store.clear();
    expect(store.items).toEqual([]);
    resolveOld(oldInbox);
    await pending;
    expect(store.items).toEqual([]);
    expect(store.unreadCount).toBe(0);
  });
  it('清空失败保留列表', async () => {
    const store = useNotifyInboxStore();
    list.mockResolvedValue(oldInbox);
    await store.load();
    clear.mockRejectedValue(new Error('offline'));
    await expect(store.clear()).rejects.toThrow('offline');
    expect(store.items).toEqual(oldInbox.items);
  });
  it('清空后仍接收服务器返回的新通知', async () => {
    const store = useNotifyInboxStore();
    const newInbox = {
      ...oldInbox,
      items: [{ ...oldInbox.items[0], source_id: 2, title: '新任务' }],
    };
    list.mockResolvedValueOnce(oldInbox).mockResolvedValueOnce(newInbox);
    clear.mockResolvedValue({ changed: true, updated_at: 2 });
    await store.load();
    await store.clear();
    expect(store.items).toEqual(newInbox.items);
    expect(store.unreadCount).toBe(1);
  });
  it('注销重置后忽略尚未结束的请求', async () => {
    const store = useNotifyInboxStore();
    let resolveOld: (value: typeof oldInbox) => void = () => {};
    list.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
    );
    const pending = store.load();
    store.$reset();
    resolveOld(oldInbox);
    await pending;
    expect(store.items).toEqual([]);
  });
});
