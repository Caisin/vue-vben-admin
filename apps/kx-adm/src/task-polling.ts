import { onScopeDispose } from 'vue';

interface PollOptions<T> {
  accept: (value: T) => Promise<void> | void;
  delay?: number;
  done?: (value: T) => boolean;
  load: () => Promise<T>;
  onError?: (error: unknown) => void;
}

/** 串行轮询；切换对象或停止后，晚到响应不会进入页面状态。 */
export function createTaskPolling<T>(options: PollOptions<T>) {
  let active = false;
  let generation = 0;
  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function clearTimer() {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  }

  function stop() {
    active = false;
    generation++;
    clearTimer();
  }

  async function tick() {
    if (!active || running) return;
    const current = generation;
    running = true;
    try {
      const value = await options.load();
      if (!active || current !== generation) return;
      await options.accept(value);
      if (current === generation && options.done?.(value)) stop();
    } catch (error) {
      if (active && current === generation) options.onError?.(error);
    } finally {
      running = false;
      if (active) {
        const hidden = typeof document !== 'undefined' && document.hidden;
        const delay =
          current === generation
            ? Math.max(options.delay ?? 1500, hidden ? 10_000 : 0)
            : 0;
        timer = setTimeout(() => void tick(), delay);
      }
    }
  }

  function start() {
    stop();
    active = true;
    void tick();
  }

  return { start, stop };
}

/** 在组件作用域销毁时停止，不要求调用方重复维护计时器。 */
export function useTaskPolling<T>(options: PollOptions<T>) {
  const polling = createTaskPolling(options);
  let disposed = false;
  onScopeDispose(() => {
    disposed = true;
    polling.stop();
  });
  return {
    start: () => {
      if (!disposed) polling.start();
    },
    stop: polling.stop,
  };
}

/** 等待型业务流程；业务负责终态判定、结果归属和错误语义。 */
export async function waitForTask<T>(options: {
  attempts?: number;
  delay?: number;
  done: (value: T) => boolean;
  isCurrent: () => boolean;
  load: () => Promise<T>;
  timeoutMessage: string;
}): Promise<T | undefined> {
  for (
    let attempt = 0;
    attempt < (options.attempts ?? 120) && options.isCurrent();
    attempt++
  ) {
    const value = await options.load();
    if (!options.isCurrent()) return;
    if (options.done(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, options.delay ?? 1000));
  }
  if (options.isCurrent()) throw new Error(options.timeoutMessage);
}
