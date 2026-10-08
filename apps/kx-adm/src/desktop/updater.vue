<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Alert, Button, message, Modal, Progress, Space } from 'antdv-next';

import { desktop } from './index';

interface UpdateView {
  currentVersion: string;
  version: string;
  notes: string;
}
interface UpdateProgress {
  stage: string;
  downloaded: number;
  total: null | number;
}
const open = ref(false);
const checking = ref(false);
const installing = ref(false);
const update = ref<null | UpdateView>(null);
const failure = ref('');
const progress = ref<UpdateProgress>({ stage: '', downloaded: 0, total: null });
const percent = computed(() =>
  progress.value.total
    ? Math.min(
        100,
        Math.floor((100 * progress.value.downloaded) / progress.value.total),
      )
    : 0,
);
let interval: ReturnType<typeof setInterval> | undefined;
let unlisten: (() => void) | undefined;
let disposed = false;
let dismissed = '';
async function check(manual = false) {
  if (checking.value || installing.value) return;
  if (manual) open.value = true;
  checking.value = true;
  failure.value = '';
  update.value = null;
  try {
    const result = await invoke<null | UpdateView>('desktop_update_check');
    if (disposed) return;
    update.value = result;
    if (result && (manual || result.version !== dismissed)) open.value = true;
    if (!result && manual) message.success('当前已是最新版本');
  } catch (error) {
    if (!disposed) failure.value = String(error);
  } finally {
    checking.value = false;
  }
}
function close() {
  if (update.value) dismissed = update.value.version;
  open.value = false;
}
async function install() {
  if (!update.value || installing.value) return;
  installing.value = true;
  failure.value = '';
  progress.value = { stage: 'downloading', downloaded: 0, total: null };
  try {
    await invoke('desktop_update_install', { version: update.value.version });
  } catch (error) {
    failure.value = String(error);
  } finally {
    installing.value = false;
  }
}
onMounted(async () => {
  if (!desktop) return;
  const off = await listen<UpdateProgress>(
    'desktop-update-progress',
    ({ payload }) => {
      progress.value = payload;
    },
  );
  if (disposed) {
    off();
    return;
  }
  unlisten = off;
  void check();
  interval = setInterval(
    () => {
      void check();
    },
    60 * 60 * 1000,
  );
});
onBeforeUnmount(() => {
  disposed = true;
  if (interval) clearInterval(interval);
  unlisten?.();
});
</script>
<template>
  <template v-if="desktop">
    <Button
      class="fixed bottom-3 right-3 z-40 shadow"
      size="small"
      :loading="checking"
      :disabled="installing"
      @click="check(true)"
    >
      {{ update ? `发现新版本 ${update.version}` : '检查客户端更新' }}
    </Button>
    <Modal
      :open="open"
      title="客户端更新"
      :footer="null"
      :closable="!installing"
      :mask-closable="!installing"
      :keyboard="!installing"
      @cancel="close"
    >
      <Alert
        v-if="failure"
        class="mb-4"
        type="error"
        :message="failure"
        show-icon
      />
      <template v-if="update">
        <p class="mb-3">{{ update.currentVersion }} → {{ update.version }}</p>
        <p class="mb-4 max-h-64 overflow-auto whitespace-pre-wrap">
          {{ update.notes || '此版本未填写更新说明。' }}
        </p>
        <p class="mb-4">
          更新完成后会重启客户端。请先保存页面修改，暂停上传、下载及预约任务，并等待在途操作结束。
        </p>
        <template v-if="installing">
          <Progress :percent="percent" status="active" />
          <p>
            {{
              progress.stage === 'installing'
                ? '正在安装，即将重启…'
                : `正在下载并校验更新包，已下载 ${(progress.downloaded / 1024 / 1024).toFixed(1)} MB`
            }}
          </p>
        </template>
        <Space v-else>
          <Button @click="close">稍后提醒</Button><Button type="primary" :disabled="checking" @click="install">
            下载并重启安装
          </Button>
        </Space>
      </template>
      <p v-else>
        {{
          checking
            ? '正在检查更新…'
            : failure
              ? '检查失败，请稍后重试。'
              : '当前已是最新版本。'
        }}
      </p>
      <Button
        v-if="failure && !installing"
        class="mt-3"
        :loading="checking"
        @click="check(true)"
      >
        重新检查
      </Button>
    </Modal>
  </template>
</template>
