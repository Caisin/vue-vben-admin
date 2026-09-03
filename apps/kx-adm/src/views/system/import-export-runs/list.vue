<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  TransferRunListItem,
  TransferRunStatus,
} from '#/api/import-export';

import { onMounted } from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';
import { Download } from '@vben/icons';
import { downloadFileFromBlob } from '@vben/utils';

import { Button, Space, Tag } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { ImportExportApi } from '#/api/import-export';

import { columns, formSchema, statusColor, statusLabel } from './data';

const route = useRoute();

const [Grid, gridApi] = useVbenVxeGrid<TransferRunListItem>({
  formOptions: { schema: formSchema(), submitOnChange: true },
  gridOptions: {
    columns: columns(),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async ({ page }, values) =>
          ImportExportApi.runs({
            definition_code:
              typeof values.definition_code === 'string'
                ? values.definition_code.trim() || undefined
                : undefined,
            direction:
              values.direction === 'import' || values.direction === 'export'
                ? values.direction
                : undefined,
            page: page.currentPage,
            size: page.pageSize,
            status:
              typeof values.status === 'string'
                ? (values.status as TransferRunStatus)
                : undefined,
          }),
      },
    },
    rowConfig: { keyField: 'id' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<TransferRunListItem>,
});

onMounted(async () => {
  const definitionCode =
    typeof route.query.definition_code === 'string'
      ? route.query.definition_code
      : undefined;
  const direction =
    route.query.direction === 'import' || route.query.direction === 'export'
      ? route.query.direction
      : undefined;
  if (!definitionCode && !direction) return;
  await gridApi.formApi.setValues({
    definition_code: definitionCode,
    direction,
  });
  await gridApi.query();
});

function expired(row: TransferRunListItem) {
  return row.expires_at <= Math.floor(Date.now() / 1000);
}

async function download(
  row: TransferRunListItem,
  kind: 'errors' | 'input' | 'result',
) {
  const blob = await ImportExportApi.runFile(row.id, kind);
  const names = {
    errors: row.error_file_name,
    input: row.input_file_name,
    result: row.result_file_name,
  };
  downloadFileFromBlob({
    fileName: names[kind] || `导入导出记录-${row.id}-${kind}`,
    source: blob,
  });
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <Grid class="management-grid" table-title="导入导出记录">
      <template #definition="{ row }">
        <div>{{ row.definition_name }}</div>
        <div class="text-xs text-muted-foreground">
          {{ row.definition_code }}
        </div>
      </template>
      <template #direction="{ row }">
        <Tag :color="row.direction === 'import' ? 'blue' : 'green'">
          {{ row.direction === 'import' ? '导入' : '导出' }}
        </Tag>
      </template>
      <template #status="{ row }">
        <Tag :color="statusColor(row.status)">
          {{ statusLabel(row.status) }}
        </Tag>
      </template>
      <template #files="{ row }">
        <Space :size="4" wrap>
          <Button
            v-if="row.input_file_name"
            :disabled="expired(row)"
            size="small"
            type="link"
            @click="download(row, 'input')"
          >
            <Download class="size-4" />原文件
          </Button>
          <Button
            v-if="row.result_file_name"
            :disabled="expired(row)"
            size="small"
            type="link"
            @click="download(row, 'result')"
          >
            <Download class="size-4" />结果
          </Button>
          <Button
            v-if="row.error_file_name"
            :disabled="expired(row)"
            size="small"
            type="link"
            @click="download(row, 'errors')"
          >
            <Download class="size-4" />错误明细
          </Button>
          <span
            v-if="
              !row.input_file_name &&
              !row.result_file_name &&
              !row.error_file_name
            "
            class="text-muted-foreground"
          >
            -
          </span>
        </Space>
      </template>
    </Grid>
  </Page>
</template>
