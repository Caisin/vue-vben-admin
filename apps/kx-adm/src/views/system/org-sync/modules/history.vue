<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  OrgSnapshotEvent,
  OrgSnapshotRecord,
  OrgUserLink,
} from '#/api/auth';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';
import { Copy } from '@vben/icons';

import { Button, message, Tag, Tooltip } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { OrgSyncApi } from '#/api/auth';
import { Times } from '#/times';
import { vxeSortParams } from '#/vxe-sort';

import {
  historyColumns,
  historyEventColor,
  historyEventLabel,
  useHistoryFormSchema,
} from '../data';

const historySortFields = ['id', 'captured_at'];

const selectedLink = ref<OrgUserLink>();
const selectedSnapshot = ref<OrgSnapshotRecord>();
const payloadText = computed(() =>
  selectedSnapshot.value
    ? JSON.stringify(selectedSnapshot.value.payload, null, 2)
    : '',
);

const [Grid, gridApi] = useVbenVxeGrid<OrgSnapshotRecord>({
  formOptions: { schema: useHistoryFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: historyColumns(),
    height: 360,
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async (params, formValues) => {
          const { page } = params;
          if (!selectedLink.value) return { items: [], total: 0 };
          const result = await OrgSyncApi.user_history(selectedLink.value.id, {
            event: formValues.event as OrgSnapshotEvent | undefined,
            ...vxeSortParams(params, historySortFields),
            page: page.currentPage,
            size: page.pageSize,
          });
          return { items: result.items, total: result.total };
        },
      },
    },
    sortConfig: { remote: true },
    rowConfig: { keyField: 'id' },
    toolbarConfig: {
      custom: false,
      export: false,
      refresh: true,
      search: true,
      zoom: false,
    },
  } as VxeTableGridOptions<OrgSnapshotRecord>,
});

const [Drawer, drawerApi] = useVbenDrawer<OrgUserLink>({
  async onOpenChange(isOpen) {
    if (!isOpen) return;
    selectedLink.value = drawerApi.getData();
    selectedSnapshot.value = undefined;
    await gridApi.formApi.reset();
    await gridApi.reload();
  },
});

function selectSnapshot(snapshot: OrgSnapshotRecord) {
  selectedSnapshot.value = snapshot;
}

async function copyPayload() {
  if (!payloadText.value) return;
  await navigator.clipboard.writeText(payloadText.value);
  message.success('原始 JSON 已复制');
}
</script>

<template>
  <Drawer
    size="min(920px, 100vw)"
    :title="
      selectedLink ? `人员历史：${selectedLink.display_name}` : '人员历史'
    "
  >
    <Grid table-title="同步快照">
      <template #capturedAt="{ row }">
        {{ Times.formatUnix(row.captured_at) }}
      </template>
      <template #event="{ row }">
        <Tag :color="historyEventColor(row.event)">
          {{ historyEventLabel(row.event) }}
        </Tag>
      </template>
      <template #payload="{ row }">
        <Button size="small" type="link" @click="selectSnapshot(row)">
          查看
        </Button>
      </template>
    </Grid>

    <section v-if="selectedSnapshot" class="payload-section">
      <div class="payload-heading">
        <h2>{{ Times.formatUnix(selectedSnapshot.captured_at) }}</h2>
        <Tooltip title="复制原始 JSON">
          <Button
            aria-label="复制原始 JSON"
            shape="circle"
            size="small"
            type="text"
            @click="copyPayload"
          >
            <template #icon><Copy /></template>
          </Button>
        </Tooltip>
      </div>
      <pre class="payload-code">{{ payloadText }}</pre>
    </section>
  </Drawer>
</template>

<style scoped>
.history-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.history-toolbar :deep(.ant-select) {
  width: min(220px, 100%);
}

.payload-section {
  margin-top: 20px;
}

.payload-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.payload-heading h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0;
}

.payload-code {
  max-height: 420px;
  padding: 12px;
  margin: 0;
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  background: hsl(var(--muted));
  border-radius: 4px;
}
</style>
