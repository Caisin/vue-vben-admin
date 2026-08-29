<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { CallRecord } from '#/api/msg';

import { ref } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { downloadFileFromBlob } from '@vben/utils';

import { Button, message, Tag } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { CallApi } from '#/api/msg';
import { displayValue } from '#/management';
import { Times } from '#/times';
import { vxeSortParams } from '#/vxe-sort';

import { useColumns, useFormSchema } from './data';

interface CallSearchValues {
  call_state?: string;
  device_code?: string;
  local_number_prefix?: string;
  peer_number_prefix?: string;
  received_between?: [Dayjs, Dayjs];
}
const downloadingVoiceId = ref<number | string>();
const callSortFields = [
  'call_state',
  'device_code',
  'local_number',
  'peer_number',
  'received_at',
];

const [Grid] = useVbenVxeGrid<CallRecord>({
  formOptions: { schema: useFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async (params, formValues: CallSearchValues) => {
          const { page } = params;
          const range = formValues.received_between;
          const result = await CallApi.list({
            call_state: formValues.call_state,
            device_code: formValues.device_code?.trim() || undefined,
            local_number_prefix:
              formValues.local_number_prefix?.trim() || undefined,
            page: page.currentPage,
            peer_number_prefix:
              formValues.peer_number_prefix?.trim() || undefined,
            received_between: range
              ? [range[0].unix(), range[1].unix()]
              : undefined,
            size: page.pageSize,
            ...vxeSortParams(params, callSortFields),
          });
          return { items: result.items, total: result.total };
        },
      },
    },
    rowConfig: { keyField: 'dedupe_key' },
    sortConfig: { remote: true },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<CallRecord>,
});

async function downloadRecording(row: CallRecord) {
  if (!hasRecording(row)) return;
  downloadingVoiceId.value = row.voice_file_id;
  try {
    const recording = await CallApi.downloadRecording(row.dedupe_key);
    downloadFileFromBlob({
      fileName: recording.file_name || row.voice_media_id || 'call-recording',
      source: recording.blob,
    });
    message.success('录音文件已开始下载');
  } finally {
    downloadingVoiceId.value = undefined;
  }
}

function hasRecording(row: CallRecord) {
  return row.voice_media_id.length > 0 && Number(row.voice_file_id) > 0;
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <header class="page-heading">
      <div>
        <h1>来电管理</h1>
        <p>查询设备来电与关联录音</p>
      </div>
    </header>

    <Grid class="management-grid" table-title="来电">
      <template #receivedAt="{ row }">
        {{ row.upstream_time || Times.formatUnix(row.received_at) }}
      </template>
      <template #callState="{ row }">
        <Tag color="blue">{{ displayValue(row.call_state) }}</Tag>
      </template>
      <template #recording="{ row }">
        <Button
          v-if="hasRecording(row)"
          v-access:code="'calls:recording-download'"
          :loading="downloadingVoiceId === row.voice_file_id"
          size="small"
          type="link"
          @click="downloadRecording(row)"
        >
          <template #icon>
            <IconifyIcon icon="lucide:download" />
          </template>
          下载
        </Button>
        <Tag v-else>待上传</Tag>
      </template>
    </Grid>
  </Page>
</template>

<style scoped>
.management-page {
  min-height: 0;
}

.management-page :deep(.management-content) {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.management-grid {
  flex: 1;
  min-height: 0;
}

.page-heading {
  flex: 0 0 auto;
  margin-bottom: 16px;
}

.page-heading h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  letter-spacing: 0;
}

.page-heading p {
  margin: 4px 0 0;
  color: hsl(var(--muted-foreground));
}

.filter-bar {
  display: grid;
  grid-template-columns: repeat(3, minmax(150px, 1fr)) 140px 190px 190px auto;
  gap: 12px;
  padding: 12px;
  margin-bottom: 12px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

@media (max-width: 1100px) {
  .filter-bar {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .filter-bar {
    grid-template-columns: 1fr;
  }
}
</style>
