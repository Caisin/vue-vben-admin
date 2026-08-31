<script lang="ts" setup>
import type {
  InvoiceImportItemState,
  InvoiceImportItemView,
  InvoiceImportView,
  InvoiceUploadView,
} from '#/api/invoice';

import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import { IconifyIcon } from '@vben/icons';

import { Button, Card, Drawer, Empty, Progress, Space, Tag } from 'antdv-next';

import { InvoiceApi } from '#/api/invoice';

import { uploadRiskText } from '../data';

const props = defineProps<{
  batch?: InvoiceImportView;
  open: boolean;
}>();

const emit = defineEmits<{ 'update:open': [value: boolean] }>();
const router = useRouter();
const downloading = ref<string>();

const progressPercent = computed(() => {
  const total = Number(props.batch?.total ?? 0);
  if (total <= 0) return 0;
  const completed =
    Number(props.batch?.succeeded ?? 0) + Number(props.batch?.failed ?? 0);
  return Math.min(100, Math.round((completed / total) * 100));
});

function itemStateColor(state: InvoiceImportItemState) {
  if (state === 'failed' || state === 'cancelled') return 'error';
  if (state === 'running') return 'processing';
  if (state === 'pending') return 'default';
  return 'success';
}

function itemStateLabel(state: InvoiceImportItemState) {
  if (state === 'failed') return '失败';
  if (state === 'cancelled') return '已取消';
  if (state === 'running') return '解析中';
  if (state === 'pending') return '等待中';
  return '成功';
}

function parseStateColor(state: InvoiceUploadView['parse_state']) {
  if (state === 'processing') return 'processing';
  if (state === 'failed') return 'error';
  if (state === 'needs_review') return 'warning';
  return 'success';
}

function parseStateLabel(state: InvoiceUploadView['parse_state']) {
  if (state === 'processing') return '识别中';
  if (state === 'failed') return '解析失败';
  if (state === 'needs_review') return '需复核';
  return '已解析';
}

async function openTaskDetail(taskId?: number | string) {
  if (!taskId) return;
  await router.push(`/system/tasks?run_id=${taskId}`);
}

async function downloadFailedFile(item: InvoiceImportItemView) {
  if (!props.batch || !item.can_download) return;
  downloading.value = String(item.id);
  try {
    const blob = await InvoiceApi.importItemContent(props.batch.id, item.id);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = item.file_name;
    link.click();
    URL.revokeObjectURL(url);
  } finally {
    downloading.value = undefined;
  }
}
</script>

<template>
  <Drawer
    :open="open"
    size="min(760px, 100vw)"
    title="上传解析结果"
    @close="emit('update:open', false)"
  >
    <div v-if="batch" class="batch-summary">
      <div class="summary-line">
        <Space wrap>
          <Tag>总数 {{ batch.total }}</Tag>
          <Tag color="success">成功 {{ batch.succeeded }}</Tag>
          <Tag :color="Number(batch.failed) > 0 ? 'error' : 'default'">
            失败 {{ batch.failed }}
          </Tag>
          <Tag v-if="Number(batch.running) > 0" color="processing">
            处理中 {{ batch.running }}
          </Tag>
        </Space>
        <Button
          v-if="batch.task_run?.id"
          size="small"
          type="link"
          @click="openTaskDetail(batch.task_run.id)"
        >
          查看任务详情
        </Button>
      </div>
      <Progress
        :percent="progressPercent"
        :status="Number(batch.failed) > 0 ? 'exception' : 'active'"
      />
      <p v-if="batch.task_run?.message" class="task-message">
        {{ batch.task_run.message }}
      </p>
    </div>
    <Empty v-if="!batch" description="暂无导入任务" />
    <Empty
      v-else-if="batch.items.length === 0"
      description="正在等待逐文件结果"
    />
    <div v-else class="upload-result-list">
      <Card v-for="item in batch.items" :key="item.id" size="small">
        <template #title>{{ item.file_name }}</template>
        <template #extra>
          <Tag :color="itemStateColor(item.state)">
            {{ itemStateLabel(item.state) }}
          </Tag>
        </template>
        <p v-if="item.error_message" class="upload-error">
          {{ item.error_message }}
        </p>
        <p v-else-if="item.upload" class="upload-message">
          {{
            item.upload.message ||
            `解析出 ${item.upload.invoices.length} 张发票`
          }}
        </p>
        <Space v-if="item.upload" wrap>
          <Tag
            :color="
              item.upload.same_user_duplicate || item.upload.used_by_other_users
                ? 'warning'
                : 'success'
            "
          >
            {{ uploadRiskText(item.upload) }}
          </Tag>
          <Tag :color="parseStateColor(item.upload.parse_state)">
            {{ parseStateLabel(item.upload.parse_state) }}
          </Tag>
          <Tag>上传 #{{ item.upload.upload_id }}</Tag>
          <Tag>发票 {{ item.upload.invoices.length }} 张</Tag>
        </Space>
        <Button
          v-if="item.can_download"
          :loading="downloading === String(item.id)"
          class="download-button"
          size="small"
          @click="downloadFailedFile(item)"
        >
          <template #icon>
            <IconifyIcon icon="lucide:download" />
          </template>
          下载原文件
        </Button>
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

.batch-summary {
  margin-bottom: 16px;
}

.summary-line {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.task-message {
  margin: 4px 0 0;
  color: hsl(var(--muted-foreground));
}

.upload-message {
  margin: 0 0 8px;
}

.upload-error {
  margin: 0;
  color: hsl(var(--destructive));
  overflow-wrap: anywhere;
}

.download-button {
  margin-top: 10px;
}
</style>
