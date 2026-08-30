<script lang="ts" setup>
import type { InvoiceUploadView } from '#/api/invoice';

import { Card, Drawer, Empty, Space, Tag } from 'antdv-next';

import { uploadRiskText } from '../data';

defineProps<{
  open: boolean;
  results: InvoiceUploadView[];
}>();

const emit = defineEmits<{ 'update:open': [value: boolean] }>();

function parseStateColor(state: InvoiceUploadView['parse_state']) {
  if (state === 'failed') return 'error';
  if (state === 'needs_review') return 'warning';
  return 'success';
}

function parseStateLabel(state: InvoiceUploadView['parse_state']) {
  if (state === 'failed') return '解析失败';
  if (state === 'needs_review') return '需复核';
  return '已解析';
}
</script>

<template>
  <Drawer
    :open="open"
    size="min(760px, 100vw)"
    title="上传解析结果"
    @close="emit('update:open', false)"
  >
    <Empty v-if="results.length === 0" description="暂无上传结果" />
    <div v-else class="upload-result-list">
      <Card v-for="item in results" :key="item.upload_id" size="small">
        <template #title>{{ item.file_name }}</template>
        <template #extra>
          <Tag :color="parseStateColor(item.parse_state)">
            {{ parseStateLabel(item.parse_state) }}
          </Tag>
        </template>
        <p class="upload-message">
          {{ item.message || `解析出 ${item.invoices.length} 张发票` }}
        </p>
        <Space wrap>
          <Tag
            :color="
              item.same_user_duplicate || item.used_by_other_users
                ? 'warning'
                : 'success'
            "
          >
            {{ uploadRiskText(item) }}
          </Tag>
          <Tag>上传 #{{ item.upload_id }}</Tag>
          <Tag>发票 {{ item.invoices.length }} 张</Tag>
        </Space>
      </Card>
    </div>
  </Drawer>
</template>

<style scoped>
.upload-result-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.upload-message {
  margin: 0 0 8px;
}
</style>
