import {
  computed,
  onActivated,
  onDeactivated,
  onMounted,
  onScopeDispose,
  ref,
  shallowRef,
  watch,
} from 'vue';

import { useUserStore } from '@vben/stores';

import { apiURL } from '#/api/request';

// 各菜单、项目和审片区共用一个展示名额，避免缓存页面的指引叠在一起。
const active = shallowRef<symbol>();
const presented = new Set<string>();
const dismissed = new Set<string>();

export function useReviewGuide() {
  const user = useUserStore();
  const owner = Symbol('review-guide');
  const step = ref(0);
  let mounted = false;
  let enabled = true;
  const key = computed(() => {
    const uid = user.userInfo?.userId;
    return uid
      ? `kx:production-guide:dismissed:${encodeURIComponent(apiURL)}:${uid}`
      : undefined;
  });
  const open = computed(() => active.value === owner);

  function release() {
    if (open.value) active.value = undefined;
  }
  function remembered(value: string) {
    if (dismissed.has(value)) return true;
    const uid = user.userInfo?.userId;
    try {
      // 保留旧版已读记录，升级后不再打扰看过任一指引的用户。
      return [
        value,
        `kx:delivery-guide:v2:${location.origin}:${uid}`,
        `kx:resource-review:guide:v3:${encodeURIComponent(apiURL)}:${uid}`,
      ].some((item) => window.localStorage.getItem(item) === 'seen');
    } catch {
      return false;
    }
  }
  function show() {
    step.value = 0;
    active.value = owner;
  }
  function dismiss() {
    const value = key.value;
    if (value) {
      dismissed.add(value);
      try {
        window.localStorage.setItem(value, 'seen');
      } catch {
        // 存储受限时仍允许关闭，本次运行由内存记录防止重复提示。
      }
    }
    release();
  }
  function autoShow() {
    const value = key.value;
    if (!mounted || !enabled || !value || active.value) return;
    if (presented.has(value) || remembered(value)) return;
    // 在打开前占用名额；同一轮挂载的其它实例不能再次自动打开。
    presented.add(value);
    show();
  }
  function onStorage(event: StorageEvent) {
    if (event.key === key.value && event.newValue === 'seen') {
      if (key.value) dismissed.add(key.value);
      release();
    }
  }
  watch(key, () => {
    release();
    autoShow();
  });
  onMounted(() => {
    mounted = true;
    window.addEventListener('storage', onStorage);
    autoShow();
  });
  onActivated(() => {
    enabled = true;
    autoShow();
  });
  onDeactivated(() => {
    enabled = false;
    release();
  });
  onScopeDispose(() => {
    release();
    window.removeEventListener('storage', onStorage);
  });
  return { dismiss, open, show, step };
}
