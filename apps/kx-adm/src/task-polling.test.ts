import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTaskPolling, waitForTask } from './task-polling';

afterEach(() => vi.useRealTimers());

describe('task polling', () => {
  it('does not load a superseded waiting task', async () => {
    const load = vi.fn();
    expect(
      await waitForTask({
        load,
        isCurrent: () => false,
        done: () => true,
        timeoutMessage: 'timeout',
      }),
    ).toBeUndefined();
    expect(load).not.toHaveBeenCalled();
  });

  it('keeps business terminal errors distinct from waiting timeouts', async () => {
    await expect(
      waitForTask({
        load: async () => 'failed',
        isCurrent: () => true,
        done: () => {
          throw new Error('business failure');
        },
        timeoutMessage: 'timeout',
      }),
    ).rejects.toThrow('business failure');
    await expect(
      waitForTask({
        load: async () => 'running',
        isCurrent: () => true,
        attempts: 0,
        done: () => false,
        timeoutMessage: 'still running',
      }),
    ).rejects.toThrow('still running');
  });
  it('stops at a terminal result', async () => {
    vi.useFakeTimers();
    const load = vi.fn().mockResolvedValue('done');
    const accept = vi.fn();
    const poll = createTaskPolling({ load, accept, done: () => true });
    poll.start();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(load).toHaveBeenCalledTimes(1);
    expect(accept).toHaveBeenCalledWith('done');
  });

  it('ignores late results after stop', async () => {
    let resolve: (value: string) => void = () => {};
    const accept = vi.fn();
    const poll = createTaskPolling({
      load: () =>
        new Promise<string>((done) => {
          resolve = done;
        }),
      accept,
    });
    poll.start();
    poll.stop();
    resolve('old');
    await Promise.resolve();
    expect(accept).not.toHaveBeenCalled();
  });

  it('restarts without overlapping requests or accepting the previous object', async () => {
    vi.useFakeTimers();
    let resolve: (value: string) => void = () => {};
    const load = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<string>((done) => {
            resolve = done;
          }),
      )
      .mockResolvedValue('new');
    const accept = vi.fn();
    const poll = createTaskPolling({ load, accept, done: () => true });
    poll.start();
    poll.start();
    expect(load).toHaveBeenCalledTimes(1);
    resolve('old');
    await vi.advanceTimersByTimeAsync(1);
    expect(accept.mock.calls).toEqual([['new']]);
  });

  it('retries loading failures and stops retries on disposal', async () => {
    vi.useFakeTimers();
    const onError = vi.fn();
    const load = vi.fn().mockRejectedValue(new Error('offline'));
    const poll = createTaskPolling({
      load,
      accept: vi.fn(),
      onError,
      delay: 10,
    });
    poll.start();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(onError).toHaveBeenCalled();
    poll.stop();
    const calls = load.mock.calls.length;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(load).toHaveBeenCalledTimes(calls);
  });
});
