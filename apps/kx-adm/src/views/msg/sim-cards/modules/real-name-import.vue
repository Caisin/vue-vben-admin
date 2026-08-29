<script lang="ts" setup>
import type { SimRealNameImport } from '#/api/msg';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { ArrowUpToLine, Download, RotateCw } from '@vben/icons';
import { downloadFileFromBlob } from '@vben/utils';

import {
  Button,
  Descriptions,
  DescriptionsItem,
  Empty,
  message,
  Space,
  Table,
  Tag,
  Upload,
} from 'antdv-next';

import { SimCardApi } from '#/api/msg';
import { Times } from '#/times';

const emit = defineEmits<{ success: [] }>();
const file = ref<File>();
const detail = ref<SimRealNameImport>();
const loading = ref(false);
const downloading = ref(false);

const columns = [
  { dataIndex: 'row_number', title: '行号', width: 72 },
  { dataIndex: 'raw_phone_number', title: '上传号码', width: 150 },
  { dataIndex: 'phone_number', title: '规范号码', width: 160 },
  { dataIndex: 'real_name', title: '实名人', width: 120 },
  { dataIndex: 'iccid', title: 'ICCID', width: 190 },
  { dataIndex: 'status', title: '状态', width: 100 },
  { dataIndex: 'error_message', title: '处理结果', minWidth: 190 },
];

const terminal = computed(() =>
  ['cancelled', 'failed', 'partially_succeeded', 'succeeded'].includes(
    detail.value?.status ?? '',
  ),
);

const statusText: Record<string, string> = {
  cancelled: '已取消',
  failed: '失败',
  partially_succeeded: '部分成功',
  queued: '排队中',
  running: '执行中',
  skipped: '已跳过',
  succeeded: '成功',
};

const [Modal, modalApi] = useVbenModal<{ import_id?: number | string }>({
  async onConfirm() {
    if (detail.value) {
      modalApi.close();
      return;
    }
    if (!file.value) {
      message.warning('请选择 CSV 文件');
      return;
    }
    loading.value = true;
    modalApi.lock();
    try {
      detail.value = await SimCardApi.createRealNameImport(file.value);
      message.success('实名导入任务已提交');
      emit('success');
    } finally {
      loading.value = false;
      modalApi.unlock();
    }
  },
  async onOpenChange(open) {
    if (!open) {
      file.value = undefined;
      detail.value = undefined;
      return;
    }
    const data = modalApi.getData();
    if (data?.import_id) await loadDetail(data.import_id);
  },
});

function selectFile(selected: File) {
  if (!selected.name.toLowerCase().endsWith('.csv')) {
    message.warning('只支持 CSV 文件');
    return Upload.LIST_IGNORE;
  }
  file.value = selected;
  return false;
}

async function downloadTemplate() {
  downloading.value = true;
  try {
    const blob = await SimCardApi.realNameImportTemplate();
    downloadFileFromBlob({
      fileName: '电话卡实名导入模板.csv',
      source: blob,
    });
  } finally {
    downloading.value = false;
  }
}

async function loadDetail(id: number | string | undefined = detail.value?.id) {
  if (!id) return;
  loading.value = true;
  try {
    detail.value = await SimCardApi.realNameImportDetail(id);
  } finally {
    loading.value = false;
  }
}

function statusColor(status: string) {
  if (status === 'succeeded') return 'success';
  if (status === 'failed' || status === 'cancelled') return 'error';
  if (status === 'partially_succeeded' || status === 'skipped')
    return 'warning';
  return 'processing';
}
</script>

<template>
  <Modal
    class="w-full max-w-240"
    :confirm-text="detail ? '关闭' : '开始导入'"
    title="导入电话卡实名"
  >
    <div class="grid gap-4">
      <template v-if="!detail">
        <Space wrap>
          <Upload
            accept=".csv,text/csv"
            :before-upload="selectFile"
            :file-list="[]"
            :max-count="1"
          >
            <Button>
              <template #icon><ArrowUpToLine /></template>
              选择 CSV
            </Button>
          </Upload>
          <Button :loading="downloading" @click="downloadTemplate">
            <template #icon><Download /></template>
            下载模板
          </Button>
          <span v-if="file" class="text-sm">{{ file.name }}</span>
        </Space>
      </template>

      <template v-else>
        <div class="flex items-center justify-between gap-3">
          <Tag :color="statusColor(detail.status)">
            {{ statusText[detail.status] ?? detail.status }}
          </Tag>
          <Button :loading="loading" @click="loadDetail()">
            <template #icon><RotateCw /></template>
            刷新结果
          </Button>
        </div>
        <Descriptions bordered :column="3" size="small">
          <DescriptionsItem label="文件">
            {{ detail.file_name }}
          </DescriptionsItem>
          <DescriptionsItem label="提交时间">
            {{ Times.formatOptionalUnix(detail.created_at) }}
          </DescriptionsItem>
          <DescriptionsItem label="任务 ID">
            {{ detail.task_run_id ?? '-' }}
          </DescriptionsItem>
          <DescriptionsItem label="总行数">
            {{ detail.total_count }}
          </DescriptionsItem>
          <DescriptionsItem label="成功">
            {{ detail.succeeded_count }}
          </DescriptionsItem>
          <DescriptionsItem label="失败 / 跳过">
            {{ detail.failed_count }} / {{ detail.skipped_count }}
          </DescriptionsItem>
        </Descriptions>
        <div v-if="!terminal" class="text-muted-foreground text-sm">
          任务正在后台执行
        </div>
        <Table
          v-if="detail.items.length"
          :columns="columns"
          :data-source="detail.items"
          :loading="loading"
          :pagination="{ pageSize: 10, showSizeChanger: false }"
          :scroll="{ x: 1050, y: 360 }"
          row-key="id"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <Tag
              v-if="column.dataIndex === 'status'"
              :color="statusColor(record.status)"
            >
              {{ statusText[record.status] ?? record.status }}
            </Tag>
          </template>
        </Table>
        <Empty v-else description="暂无逐行结果" />
      </template>
    </div>
  </Modal>
</template>
