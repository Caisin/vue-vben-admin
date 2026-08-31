<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  InvoiceExportDispatchView,
  InvoiceExportScope,
  InvoiceExportView,
  InvoiceImportDispatchView,
  InvoiceImportView,
  InvoiceItemView,
  InvoiceListQuery,
  InvoiceStatisticsView,
} from '#/api/invoice';

import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Card,
  Checkbox,
  message,
  Modal,
  Space,
  Statistic,
  Tag,
  Tooltip,
} from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { InvoiceApi } from '#/api/invoice';
import { requestErrorMessage } from '#/request-errors';
import { vxeSortParams } from '#/vxe-sort';

import {
  cleanInvoiceQuery,
  createExportPayload,
  invoiceSortFields,
  invoiceTypeLabel,
  useColumns,
  useFormSchema,
} from './data';
import ExportHistoryDrawer from './modules/export-history-drawer.vue';
import InvoiceDetailDrawer from './modules/invoice-detail-drawer.vue';
import InvoiceEditModal from './modules/invoice-edit-modal.vue';
import UploadResultDrawer from './modules/upload-result-drawer.vue';

type CheckboxGrid = { getCheckboxRecords?: () => InvoiceItemView[] };

const { hasAccessByCodes } = useAccess();
const route = useRoute();
const canAdminInvoice = computed(() => hasAccessByCodes(['invoice:admin']));
const canExportInvoice = computed(() => hasAccessByCodes(['invoice:export']));
const canUpdateInvoice = computed(() => hasAccessByCodes(['invoice:update']));
const canUploadInvoice = computed(() => hasAccessByCodes(['invoice:upload']));
const uploadInputRef = ref<HTMLInputElement>();
const uploadFolderInputRef = ref<HTMLInputElement>();
const uploading = ref(false);
const exportLoading = ref<InvoiceExportScope>();
const selectedRows = ref<InvoiceItemView[]>([]);
const currentFilter = ref<InvoiceListQuery>({});
const activeImport = ref<InvoiceImportView>();
const uploadResultOpen = ref(false);
let importAbortController: AbortController | undefined;
const detailOpen = ref(false);
const editOpen = ref(false);
const exportHistoryOpen = ref(false);
const activeInvoice = ref<InvoiceItemView>();
const exportRuns = ref<InvoiceExportDispatchView[]>([]);
const markSubmittedToFinance = ref(false);
const statistics = ref<InvoiceStatisticsView>({
  amount_tax_total: '0',
  needs_review_count: 0,
  submitted_count: 0,
  tax_amount_total: '0',
  total_count: 0,
  unsubmitted_count: 0,
});

const [Grid, gridApi] = useVbenVxeGrid<InvoiceItemView>({
  formOptions: {
    schema: useFormSchema(canAdminInvoice.value),
    submitOnChange: true,
  },
  gridEvents: {
    checkboxAll: updateSelectedRows,
    checkboxChange: updateSelectedRows,
  },
  gridOptions: {
    checkboxConfig: { reserve: true },
    columns: useColumns(canAdminInvoice.value, canExportInvoice.value),
    height: 'auto',
    keepSource: true,
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async (params, formValues) => {
          const { page } = params;
          const filter = cleanInvoiceQuery(formValues);
          currentFilter.value = filter;
          await refreshStatistics(filter);
          const result = await InvoiceApi.list({
            ...filter,
            ...vxeSortParams(params, invoiceSortFields),
            page: page.currentPage,
            size: page.pageSize,
          });
          selectedRows.value = [];
          return {
            items: result.items.map((item) => ({
              ...item,
              _row_key: `${item.uid}:${item.invoice_id}`,
            })),
            total: result.total,
          };
        },
      },
    },
    rowConfig: { keyField: '_row_key' },
    sortConfig: {
      defaultSort: { field: 'uploaded_at', order: 'desc' },
      remote: true,
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<InvoiceItemView>,
});

const selectedCount = computed(() => selectedRows.value.length);

onMounted(async () => {
  const importValue = Array.isArray(route.query.import_id)
    ? route.query.import_id[0]
    : route.query.import_id;
  const importId = Number(importValue);
  if (Number.isInteger(importId) && importId > 0) {
    const detail = await InvoiceApi.importDetail(importId);
    activeImport.value = detail;
    uploadResultOpen.value = true;
    if (detail.task_run && !isTerminalTask(detail.task_run.status)) {
      void monitorImport({
        import_id: detail.id,
        task_run: detail.task_run,
        total: detail.total,
      });
    }
  }

  const queryValue = Array.isArray(route.query.export_id)
    ? route.query.export_id[0]
    : route.query.export_id;
  const exportId = Number(queryValue);
  if (Number.isInteger(exportId) && exportId > 0) {
    const detail = await InvoiceApi.exportDetail(exportId);
    exportRuns.value = [
      {
        duplicate: false,
        export: detail,
        message: '',
        task_run: null,
      },
    ];
    exportHistoryOpen.value = true;
  }
});

onBeforeUnmount(() => importAbortController?.abort());

function updateSelectedRows() {
  const grid = gridApi.grid as CheckboxGrid | undefined;
  selectedRows.value =
    typeof grid?.getCheckboxRecords === 'function'
      ? grid.getCheckboxRecords()
      : [];
}

async function refreshStatistics(filter = currentFilter.value) {
  statistics.value = await InvoiceApi.statistics(filter);
}

function triggerUpload() {
  uploadInputRef.value?.click();
}

function triggerUploadFolder() {
  uploadFolderInputRef.value?.click();
}

async function onFilesPicked(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = [...(input.files ?? [])];
  input.value = '';
  if (files.length === 0) return;
  uploading.value = true;
  try {
    const dispatch = await InvoiceApi.uploadFiles(files);
    activeImport.value = {
      failed: dispatch.task_run.failed_count,
      id: dispatch.import_id,
      items: [],
      running: dispatch.task_run.running_count,
      succeeded: dispatch.task_run.succeeded_count,
      task_run: dispatch.task_run,
      total: dispatch.total,
    };
    uploadResultOpen.value = true;
    message.info(`已提交 ${files.length} 个文件，正在后台解析`);
    await monitorImport(dispatch);
  } finally {
    uploading.value = false;
  }
}

async function monitorImport(dispatch: InvoiceImportDispatchView) {
  importAbortController?.abort();
  const controller = new AbortController();
  importAbortController = controller;
  try {
    await InvoiceApi.watchImport(
      dispatch.import_id,
      (run) => {
        if (!activeImport.value) return;
        activeImport.value = {
          ...activeImport.value,
          failed: run.failed_count,
          running: run.running_count,
          succeeded: run.succeeded_count,
          task_run: run,
          total: run.total_count ?? activeImport.value.total,
        };
      },
      controller.signal,
    );
    const result = await InvoiceApi.importDetail(dispatch.import_id);
    activeImport.value = result;
    const total = Number(result.total);
    const succeeded = Number(result.succeeded);
    const failed = Number(result.failed);
    if (failed > 0) {
      message.warning(
        `批次完成：共 ${total} 个，成功 ${succeeded} 个，失败 ${failed} 个`,
      );
    } else {
      message.success(`已解析 ${succeeded} 个文件`);
    }
    if (succeeded > 0) await gridApi.query();
  } catch (error) {
    if (!controller.signal.aborted) {
      message.error(requestErrorMessage(error, '导入进度连接中断'));
      activeImport.value = await InvoiceApi.importDetail(dispatch.import_id);
    }
  } finally {
    if (importAbortController === controller) importAbortController = undefined;
  }
}

function isTerminalTask(status: string) {
  return [
    'cancelled',
    'failed',
    'partially_succeeded',
    'skipped',
    'succeeded',
  ].includes(status);
}

async function openDetail(row: InvoiceItemView) {
  activeInvoice.value = row;
  detailOpen.value = true;
  try {
    activeInvoice.value = await InvoiceApi.detail(row.invoice_id, row.uid);
  } catch (error) {
    activeInvoice.value = row;
    throw error;
  }
}

function openEdit(row: InvoiceItemView) {
  if (!canUpdateInvoice.value) return;
  activeInvoice.value = row;
  editOpen.value = true;
}

async function onSaved(row: InvoiceItemView) {
  activeInvoice.value = row;
  await gridApi.query();
}

function exportDescription(scope: InvoiceExportScope) {
  if (scope === 'selected') {
    return `将导出已勾选的 ${selectedCount.value} 张发票。`;
  }
  return '将导出当前筛选条件命中的全部发票。';
}

async function createExport(scope: InvoiceExportScope) {
  updateSelectedRows();
  if (scope === 'selected' && selectedRows.value.length === 0) {
    message.warning('请先勾选需要导出的发票');
    return;
  }
  Modal.confirm({
    content: `${exportDescription(scope)}${
      markSubmittedToFinance.value ? '导出成功后会同时标记为已提交财务。' : ''
    }`,
    okText: '创建导出任务',
    title: scope === 'selected' ? '导出所选发票' : '按当前筛选导出',
    async onOk() {
      exportLoading.value = scope;
      try {
        const result = await InvoiceApi.createExport(
          createExportPayload({
            filter: currentFilter.value,
            markSubmitted: markSubmittedToFinance.value,
            scope,
            selectedRows: selectedRows.value,
          }),
        );
        exportRuns.value = [result, ...exportRuns.value];
        if (result.duplicate) {
          message.info(result.message || '已有相同导出任务，已展示现有任务');
        } else {
          message.success(result.message || '导出任务已创建');
        }
        exportHistoryOpen.value = true;
        await gridApi.query();
      } finally {
        exportLoading.value = undefined;
      }
    },
  });
}

async function downloadOriginal(row: InvoiceItemView) {
  const blob = await InvoiceApi.fileContent(row.upload_id);
  downloadBlob(blob, row.original_file_name || `invoice-${row.invoice_id}`);
}

async function downloadExport(row: InvoiceExportView) {
  const blob = await InvoiceApi.exportContent(row.id);
  downloadBlob(blob, `invoice-export-${row.id}.zip`);
}

function onExportRefresh(rows: InvoiceExportDispatchView[]) {
  exportRuns.value = rows;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <Page
    auto-content-height
    class="invoice-page"
    content-class="invoice-content"
  >
    <header class="page-heading">
      <h1>发票管理</h1>
      <Space>
        <input
          ref="uploadInputRef"
          accept=".pdf,.ofd,.xml,.jpg,.jpeg,.png,.bmp,.webp,.tiff"
          class="hidden-input"
          multiple
          type="file"
          @change="onFilesPicked"
        />
        <input
          ref="uploadFolderInputRef"
          accept=".pdf,.ofd,.xml,.jpg,.jpeg,.png,.bmp,.webp,.tiff"
          class="hidden-input"
          multiple
          type="file"
          webkitdirectory
          @change="onFilesPicked"
        />
        <Button
          v-if="canUploadInvoice"
          :loading="uploading"
          type="primary"
          @click="triggerUpload"
        >
          <template #icon>
            <IconifyIcon icon="lucide:file-up" />
          </template>
          上传发票文件
        </Button>
        <Button
          v-if="canUploadInvoice"
          :loading="uploading"
          @click="triggerUploadFolder"
        >
          <template #icon>
            <IconifyIcon icon="lucide:folder-up" />
          </template>
          上传文件夹
        </Button>
        <Button v-if="canExportInvoice" @click="exportHistoryOpen = true">
          导出任务
        </Button>
      </Space>
    </header>

    <section class="stats-bar">
      <Card size="small">
        <Statistic title="发票总数" :value="Number(statistics.total_count)" />
      </Card>
      <Card size="small">
        <Statistic
          title="未提交财务"
          :value="Number(statistics.unsubmitted_count)"
        />
      </Card>
      <Card size="small">
        <Statistic
          title="需复核"
          :value="Number(statistics.needs_review_count)"
        />
      </Card>
      <Card size="small">
        <Statistic title="价税合计" :value="statistics.amount_tax_total" />
      </Card>
      <Card size="small">
        <Statistic title="税额合计" :value="statistics.tax_amount_total" />
      </Card>
    </section>

    <Grid class="invoice-grid" table-title="发票列表">
      <template #toolbar-tools>
        <Space v-if="canExportInvoice" wrap>
          <Checkbox v-model:checked="markSubmittedToFinance">
            导出后提交财务
          </Checkbox>
          <Button
            :disabled="selectedCount === 0"
            :loading="exportLoading === 'selected'"
            @click="createExport('selected')"
          >
            导出所选 {{ selectedCount || '' }}
          </Button>
          <Button
            :loading="exportLoading === 'filtered'"
            type="primary"
            @click="createExport('filtered')"
          >
            按当前筛选导出
          </Button>
        </Space>
      </template>

      <template #invoiceNo="{ row }">
        <a class="invoice-link" @click="openDetail(row)">
          {{ row.invoice_no || `发票 #${row.invoice_id}` }}
        </a>
        <div class="muted">{{ invoiceTypeLabel(row.invoice_type) }}</div>
      </template>
      <template #financeState="{ row }">
        <Tag :color="row.submitted_to_finance ? 'success' : 'warning'">
          {{ row.submitted_to_finance ? '已提交' : '未提交' }}
        </Tag>
      </template>
      <template #duplicate="{ row }">
        <Tooltip
          :title="
            row.duplicate_user_count
              ? canAdminInvoice
                ? '跨用户重复，点击详情查看用户列表'
                : '跨用户重复'
              : '未发现跨用户重复'
          "
        >
          <Tag :color="row.duplicate_user_count ? 'warning' : 'success'">
            {{
              row.duplicate_user_count
                ? `重复 ${row.duplicate_user_count}`
                : '正常'
            }}
          </Tag>
        </Tooltip>
      </template>
      <template #operation="{ row }">
        <Space>
          <Button
            v-if="canUpdateInvoice"
            size="small"
            type="link"
            @click="openEdit(row)"
          >
            维护
          </Button>
          <Button size="small" type="link" @click="downloadOriginal(row)">
            原文件
          </Button>
          <Button size="small" type="link" @click="openDetail(row)">
            详情
          </Button>
        </Space>
      </template>
    </Grid>

    <InvoiceDetailDrawer
      v-model:open="detailOpen"
      :can-admin="canAdminInvoice"
      :can-update="canUpdateInvoice"
      :invoice="activeInvoice"
      @edit="openEdit"
    />
    <InvoiceEditModal
      v-model:open="editOpen"
      :invoice="activeInvoice"
      @saved="onSaved"
    />
    <UploadResultDrawer v-model:open="uploadResultOpen" :batch="activeImport" />
    <ExportHistoryDrawer
      v-model:open="exportHistoryOpen"
      :exports="exportRuns"
      @download="downloadExport"
      @refresh="onExportRefresh"
    />
  </Page>
</template>

<style scoped>
.invoice-page {
  min-height: 0;
}

.invoice-page :deep(.invoice-content) {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
}

.page-heading {
  display: flex;
  flex: 0 0 auto;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
}

.page-heading h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
}

.stats-bar {
  display: grid;
  grid-template-columns: repeat(5, minmax(120px, 1fr));
  gap: 8px;
}

.invoice-grid {
  flex: 1;
  min-height: 0;
}

.invoice-link {
  font-weight: 600;
}

.muted {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.hidden-input {
  display: none;
}

@media (max-width: 960px) {
  .page-heading {
    flex-direction: column;
    align-items: flex-start;
  }

  .stats-bar {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .stats-bar > :last-child:nth-child(odd) {
    grid-column: span 2;
  }

  .invoice-grid :deep(.vxe-toolbar) {
    flex-wrap: wrap;
    gap: 8px;
    height: auto;
  }

  .invoice-grid :deep(.vxe-buttons--wrapper),
  .invoice-grid :deep(.vxe-tools--wrapper) {
    width: 100%;
  }

  .invoice-grid :deep(.vxe-tools--wrapper) {
    flex-wrap: wrap;
    justify-content: flex-start;
  }
}
</style>
