<script setup lang="ts">
import type { SyncSummary, SyncTarget } from '#/api/data-sync-operations';

import { ref, watch } from 'vue';

import { Alert, Button, Space, Tag } from 'antdv-next';

import { SyncOperationsApi } from '#/api/data-sync-operations';
import { requestErrorMessage } from '#/request-errors';

import { states } from './data';
import { actionLabels, recoveryAdvice } from './operation-data';
const props = defineProps<{ target: SyncTarget }>();
const data = ref<SyncSummary>();
const errorText = ref('');
const busy = ref(false);
let generation = 0;
async function load() {
  const current = ++generation;
  busy.value = true;
  try {
    const r = await SyncOperationsApi.summary(props.target);
    if (current === generation) {
      data.value = r;
      errorText.value = '';
    }
  } catch (error) {
    if (current === generation)
      errorText.value = requestErrorMessage(error, '状态加载失败');
  } finally {
    if (current === generation) busy.value = false;
  }
}
watch(
  () => `${props.target.kind}:${props.target.id}`,
  () => {
    data.value = undefined;
    void load();
  },
  { immediate: true },
);
</script>
<template>
  <div class="mb-4 rounded border p-3">
    <Space wrap class="mb-2">
      <strong>当前状态与下一步</strong><Button size="small" :loading="busy" @click="load"> 刷新状态 </Button>
    </Space>
    <Alert v-if="errorText" type="error" :message="errorText" />
    <template v-if="data">
      <Space wrap>
        <Tag>配置：{{ states[data.configuration] || data.configuration }}</Tag><Tag>运行：{{ states[data.state] || data.state }}</Tag><Tag>{{ data.schedule_paused ? '调度已暂停' : '调度未暂停' }}</Tag><Tag v-if="data.pending_batches" color="warning">
          {{ data.pending_batches }} 个批次待对账
        </Tag>
      </Space>
      <Alert
        v-if="data.last_error"
        type="warning"
        :message="recoveryAdvice[data.last_error] || data.last_error"
        class="mt-2"
      />
      <div class="mt-2 text-sm">
        可执行：{{
          data.actions
            .filter((a) => a.allowed)
            .map((a) => actionLabels[a.action])
            .join('、') || '暂无可执行操作'
        }}
      </div>
      <div v-if="data.pending_batches" class="mt-2 text-sm">
        先核对回执，再恢复同步；强制停止不会跳过未知提交。
      </div>
      <details class="mt-2">
        <summary>查看操作限制</summary>
        <p v-for="a in data.actions.filter((a) => !a.allowed)" :key="a.action">
          {{ actionLabels[a.action] }}：{{ a.reason }}
        </p>
      </details>
    </template>
  </div>
</template>
