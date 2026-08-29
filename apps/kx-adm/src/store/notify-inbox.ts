import type { NotifyInboxSourceType, NotifyInboxView } from '#/api/notify';

import { computed, ref } from 'vue';

import { defineStore } from 'pinia';

import { NotifyInboxApi } from '#/api/notify';

const EMPTY_INBOX: NotifyInboxView = {
  items: [],
  server_time: 0,
  unread_count: 0,
};

export const useNotifyInboxStore = defineStore('notify-inbox', () => {
  const inbox = ref({ ...EMPTY_INBOX });
  const loading = ref(false);
  const loadFailed = ref(false);
  const initialized = ref(false);

  const items = computed(() => inbox.value.items);
  const unreadCount = computed(() => inbox.value.unread_count);

  async function load(force = false) {
    if (loading.value && !force) return;
    loading.value = true;
    loadFailed.value = false;
    try {
      inbox.value = await NotifyInboxApi.list({ size: 100 });
      initialized.value = true;
    } catch (error) {
      loadFailed.value = true;
      throw error;
    } finally {
      loading.value = false;
    }
  }

  async function markRead(
    source_type: NotifyInboxSourceType,
    source_id: number | string,
  ) {
    await NotifyInboxApi.mark_read(source_type, source_id);
    await load(true);
  }

  async function dismiss(
    source_type: NotifyInboxSourceType,
    source_id: number | string,
  ) {
    await NotifyInboxApi.dismiss(source_type, source_id);
    await load(true);
  }

  async function markAllRead() {
    await NotifyInboxApi.mark_all_read();
    await load(true);
  }

  async function clear() {
    await NotifyInboxApi.clear();
    await load(true);
  }

  function $reset() {
    inbox.value = { ...EMPTY_INBOX };
    loading.value = false;
    loadFailed.value = false;
    initialized.value = false;
  }

  return {
    $reset,
    clear,
    dismiss,
    initialized,
    items,
    load,
    loadFailed,
    loading,
    markAllRead,
    markRead,
    unreadCount,
  };
});
