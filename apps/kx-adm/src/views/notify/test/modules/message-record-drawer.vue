<script lang="ts" setup>
import type { NotifyDeliveryAttempt, NotifyMessage } from '#/api/notify';

import { ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Descriptions,
  DescriptionsItem,
  Drawer,
  Empty,
  Spin,
  Tag,
} from 'antdv-next';

import { NotifyMessageApi } from '#/api/notify';
import { Times } from '#/times';

const props = defineProps<{
  message?: NotifyMessage;
  open: boolean;
}>();

const emit = defineEmits<{
  edit: [message: NotifyMessage];
  'update:open': [open: boolean];
}>();

const loading = ref(false);
const detail = ref<NotifyMessage>();
const attempts = ref<NotifyDeliveryAttempt[]>([]);

watch(
  () => [props.open, props.message?.id] as const,
  async ([open, id]) => {
    if (!open || !id) return;
    loading.value = true;
    try {
      const [message, page] = await Promise.all([
        NotifyMessageApi.detail(id),
        NotifyMessageApi.attempts(id, { page: 1, size: 100 }),
      ]);
      detail.value = message;
      attempts.value = page.items;
    } finally {
      loading.value = false;
    }
  },
  { immediate: true },
);

function close() {
  emit('update:open', false);
}

function editAndResend() {
  if (!detail.value) return;
  emit('edit', detail.value);
  close();
}

function jsonText(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

function attemptColor(status: NotifyDeliveryAttempt['status']) {
  if (status === 'succeeded') return 'success';
  if (status === 'failed') return 'error';
  return 'processing';
}
</script>

<template>
  <Drawer
    :open="open"
    destroy-on-close
    title="消息发送记录"
    width="min(920px, 100vw)"
    @close="close"
  >
    <Spin :spinning="loading">
      <Descriptions v-if="detail" bordered :column="1" size="small">
        <DescriptionsItem label="消息编码">
          {{ detail.message_code }}
        </DescriptionsItem>
        <DescriptionsItem label="标题">{{ detail.subject }}</DescriptionsItem>
        <DescriptionsItem label="内容类型">
          {{ detail.content_type }}
        </DescriptionsItem>
        <DescriptionsItem label="正文">
          <pre class="record-json">{{ detail.content }}</pre>
        </DescriptionsItem>
        <DescriptionsItem label="Payload">
          <pre class="record-json">{{ jsonText(detail.payload) }}</pre>
        </DescriptionsItem>
        <DescriptionsItem label="创建时间">
          {{ Times.formatOptionalUnix(detail.created_at) }}
        </DescriptionsItem>
        <DescriptionsItem label="最近错误">
          {{ detail.last_error || '-' }}
        </DescriptionsItem>
      </Descriptions>

      <div class="attempt-heading">投递记录</div>
      <Empty
        v-if="!loading && attempts.length === 0"
        description="暂无投递记录"
      />
      <div v-else class="attempt-list">
        <section
          v-for="item in attempts"
          :key="String(item.id)"
          class="attempt-row"
        >
          <div class="attempt-meta">
            <Tag :color="attemptColor(item.status)">{{ item.status }}</Tag>
            <span>第 {{ item.attempt_no }} 次</span>
            <span>{{ Times.formatOptionalUnix(item.started_at) }}</span>
          </div>
          <div class="attempt-grid">
            <div>
              <strong>发送参数</strong>
              <pre class="record-json">{{
                jsonText(item.request_summary)
              }}</pre>
            </div>
            <div>
              <strong>响应参数</strong>
              <pre class="record-json">{{
                jsonText(item.response_summary)
              }}</pre>
            </div>
          </div>
          <div v-if="item.error_message" class="attempt-error">
            {{ item.error_message }}
          </div>
        </section>
      </div>
    </Spin>

    <template #footer>
      <div class="drawer-actions">
        <Button @click="close">关闭</Button>
        <Button
          v-access:code="'notify:test:send'"
          :disabled="!detail"
          type="primary"
          @click="editAndResend"
        >
          <template #icon><IconifyIcon icon="lucide:send" /></template>
          编辑并重发
        </Button>
      </div>
    </template>
  </Drawer>
</template>

<style scoped>
.attempt-heading {
  margin: 20px 0 10px;
  font-size: 15px;
  font-weight: 600;
}

.attempt-list {
  display: grid;
  gap: 12px;
}

.attempt-row {
  padding: 12px;
  border: 1px solid var(--ant-color-border-secondary);
  border-radius: 6px;
}

.attempt-meta,
.drawer-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.drawer-actions {
  justify-content: flex-end;
}

.attempt-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 10px;
}

.record-json {
  max-width: 100%;
  max-height: 280px;
  padding: 10px;
  margin: 6px 0 0;
  overflow: auto;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  background: var(--ant-color-fill-quaternary);
  border-radius: 4px;
}

.attempt-error {
  margin-top: 8px;
  color: var(--ant-color-error);
  overflow-wrap: anywhere;
}

@media (max-width: 720px) {
  .attempt-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
