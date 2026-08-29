<script lang="ts" setup>
import type { MenuProps } from 'antdv-next';

import type { EditableDicData } from './dictionary-data-edit';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { DicCode, DicCodeWrite } from '#/api';

import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { useSortable } from '@vben/hooks';
import { GripVertical, Plus } from '@vben/icons';

import { Button, Dropdown, message, Modal, Space, Switch } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { DictionaryApi } from '#/api';
import { invalidateDictionary } from '#/components/dictionary';
import { useVxeRowContextMenu } from '#/views/_shared/use-vxe-row-context-menu';
import { vxeSortParams } from '#/vxe-sort';

import { useCodeColumns, useDataColumns, useFormSchema } from './data';
import {
  buildDicDataWrite,
  createDicDataDraft,
  toEditableDicDataRows,
} from './dictionary-data-edit';
import ContentModal from './modules/modal.vue';

const dicCodeSortFields = ['code', 'dic_name', 'created_at'];

const selectedCode = ref<DicCode>();
const editingCode = ref<DicCode>();
const editingData = ref<EditableDicData>();
const dataRows = ref<EditableDicData[]>([]);
let sortable: null | { destroy: () => void } = null;
const codeContextMenuItems: MenuProps['items'] = [
  { key: 'config', label: '配置项' },
  { danger: true, key: 'delete', label: '删除' },
];
const dataContextMenuItems: MenuProps['items'] = [
  { danger: true, key: 'delete', label: '删除' },
];
const codeRowContextMenu = useVxeRowContextMenu<DicCode>(
  codeContextMenuItems,
  (key, row) => {
    if (key === 'config') {
      void openDataConfig(row);
      return;
    }
    if (key === 'delete') confirmDeleteCode(row);
  },
);
const dataRowContextMenu = useVxeRowContextMenu<EditableDicData>(
  dataContextMenuItems,
  (key, row) => {
    if (key === 'delete') confirmDeleteDataRow(row);
  },
);

const [CodeForm, codeFormApi] = useVbenForm({
  layout: 'vertical',
  wrapperClass: 'grid-cols-1 md:grid-cols-2',
  schema: [
    {
      component: 'Input',
      fieldName: 'code',
      formItemClass: 'col-span-1',
      label: '字典编码',
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'dic_name',
      formItemClass: 'col-span-1',
      label: '字典名称',
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'help_msg',
      formItemClass: 'md:col-span-2',
      label: '帮助信息',
    },
    {
      component: 'Switch',
      defaultValue: true,
      fieldName: 'enabled',
      formItemClass: 'col-span-1',
      label: '启用',
    },
    {
      component: 'Textarea',
      componentProps: { autoSize: { maxRows: 6, minRows: 3 } },
      fieldName: 'remark',
      formItemClass: 'md:col-span-2',
      label: '备注',
    },
  ],
  showDefaultActions: false,
});

const codeModalTitle = computed(() =>
  editingCode.value ? '编辑字典' : '新建字典',
);
const dataConfigTitle = computed(() =>
  selectedCode.value
    ? `${selectedCode.value.dic_name} · 字典项配置`
    : '字典项配置',
);
const dataEditTitle = computed(() =>
  editingData.value?.__is_new ? '新增字典项' : '编辑字典项',
);

const [CodeModal, codeModalApi] = useVbenModal({
  connectedComponent: ContentModal,
  destroyOnClose: true,
  async onConfirm() {
    const { valid } = await codeFormApi.validate();
    if (!valid) return;

    codeModalApi.lock();
    try {
      const values = await codeFormApi.getValues();
      const code = editingCode.value?.code ?? String(values.code);
      const { code: _code, ...data } = values;
      const saved = await DictionaryApi.saveCode(code, data as DicCodeWrite);
      invalidateDictionary(code);
      message.success('保存成功');
      codeModalApi.close();
      await codeGridApi.query();
      if (selectedCode.value?.code === code) {
        selectedCode.value = saved;
      }
    } finally {
      codeModalApi.lock(false);
    }
  },
});

const [DataForm, dataFormApi] = useVbenForm({
  layout: 'vertical',
  wrapperClass: 'grid-cols-1 md:grid-cols-2',
  schema: [
    {
      component: 'Input',
      fieldName: 'label',
      formItemClass: 'col-span-1',
      label: '显示文本',
      rules: 'required',
    },
    {
      component: 'Textarea',
      componentProps: {
        autoSize: { maxRows: 14, minRows: 6 },
        class: 'font-mono text-xs',
      },
      fieldName: '__value_text',
      formItemClass: 'md:col-span-2',
      label: '字典值 JSON',
      rules: 'required',
    },
    {
      component: 'Textarea',
      componentProps: { autoSize: { maxRows: 5, minRows: 2 } },
      fieldName: 'remark',
      formItemClass: 'md:col-span-2',
      label: '备注',
    },
  ],
  showDefaultActions: false,
});

const [DataEditModal, dataEditModalApi] = useVbenModal({
  connectedComponent: ContentModal,
  destroyOnClose: true,
  class: 'w-[min(620px,calc(100vw-20px))]',
  async onConfirm() {
    const { valid } = await dataFormApi.validate();
    if (!valid || !editingData.value) return;

    dataEditModalApi.lock();
    try {
      const values = await dataFormApi.getValues();
      editingData.value.label = String(values.label ?? '');
      editingData.value.__value_text = String(values.__value_text ?? '');
      editingData.value.remark = String(values.remark ?? '');
      if (await saveDataRow(editingData.value)) {
        dataEditModalApi.close();
      }
    } finally {
      dataEditModalApi.lock(false);
    }
  },
});

const [DataConfigModal, dataConfigModalApi] = useVbenModal({
  connectedComponent: ContentModal,
  destroyOnClose: true,
  class: 'w-[min(860px,calc(100vw-20px))]',
  contentClass: 'p-2',
  footer: false,
  fullscreenButton: true,
});

const [CodeGrid, codeGridApi] = useVbenVxeGrid<DicCode>({
  formOptions: {
    schema: useFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useCodeColumns(onCodeEnabledChange),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async (params, formValues) => {
          const { page } = params;
          const result = await DictionaryApi.codePage({
            ...formValues,
            ...vxeSortParams(params, dicCodeSortFields),
            page: page.currentPage,
            size: page.pageSize,
          });
          return { items: result.items, total: result.total };
        },
      },
    },
    sortConfig: { remote: true },
    rowConfig: { isCurrent: true, keyField: 'code' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<DicCode>,
});

const [DataGrid, dataGridApi] = useVbenVxeGrid<EditableDicData>({
  gridOptions: {
    columns: useDataColumns(onDataEnabledChange),
    height: '100%',
    keepSource: true,
    pagerConfig: { enabled: false },
    rowConfig: { keyField: 'id' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: false,
      search: false,
      zoom: true,
    },
  } as VxeTableGridOptions<EditableDicData>,
});

async function onCodeEnabledChange(enabled: boolean, row: DicCode) {
  const saved = await DictionaryApi.saveCode(row.code, {
    dic_name: row.dic_name,
    enabled,
    help_msg: row.help_msg,
    remark: row.remark,
  });
  invalidateDictionary(row.code);
  if (selectedCode.value?.code === row.code) selectedCode.value = saved;
  return true;
}

async function onDataEnabledChange(enabled: boolean, row: EditableDicData) {
  return saveDataRow({ ...row, enabled });
}

async function openCodeCreate() {
  editingCode.value = undefined;
  codeModalApi.open();
  await nextTick();
  await codeFormApi.reset();
  await codeFormApi.updateSchema([
    { componentProps: { disabled: false }, fieldName: 'code' },
  ]);
}

async function openCodeEdit(row: DicCode) {
  editingCode.value = row;
  codeModalApi.open();
  await nextTick();
  await codeFormApi.reset();
  const detail = await DictionaryApi.detail(row.code);
  await codeFormApi.setValues(detail);
  await codeFormApi.updateSchema([
    { componentProps: { disabled: true }, fieldName: 'code' },
  ]);
}

async function deleteCode(row: DicCode) {
  await DictionaryApi.deleteCode(row.code);
  invalidateDictionary(row.code);
  if (selectedCode.value?.code === row.code) {
    selectedCode.value = undefined;
    dataConfigModalApi.close();
  }
  message.success('删除成功');
  await codeGridApi.query();
}

function confirmDeleteCode(row: DicCode) {
  Modal.confirm({
    async onOk() {
      await deleteCode(row);
    },
    okText: '删除',
    okType: 'danger',
    title: `确认删除字典「${row.dic_name}」？`,
  });
}

async function setDataRows(rows: EditableDicData[]) {
  dataRows.value = rows;
  await nextTick();
  await dataGridApi.grid.reloadData(rows);
  await dataRowContextMenu.bind(dataGridApi.grid);
  await initSortable();
}

async function loadDataRows() {
  if (!selectedCode.value) {
    await setDataRows([]);
    return;
  }

  dataGridApi.setLoading(true);
  try {
    const rows = await DictionaryApi.dataList(selectedCode.value.code);
    await setDataRows(toEditableDicDataRows(rows));
  } finally {
    dataGridApi.setLoading(false);
  }
}

async function openDataConfig(row: DicCode) {
  selectedCode.value = row;
  dataConfigModalApi.open();
  await nextTick();
  await loadDataRows();
}

async function openDataCreate() {
  if (!selectedCode.value) {
    message.warning('请先选择字典');
    return;
  }
  editingData.value = createDicDataDraft(
    selectedCode.value.code,
    dataRows.value.length + 1,
  );
  dataEditModalApi.open();
  await nextTick();
  await dataFormApi.reset();
  await dataFormApi.setValues(editingData.value);
}

async function openDataEdit(row: EditableDicData) {
  editingData.value = row;
  dataEditModalApi.open();
  await nextTick();
  await dataFormApi.reset();
  await dataFormApi.setValues(row);
}

async function saveDataRow(row: EditableDicData): Promise<boolean> {
  if (!selectedCode.value) return false;
  const payload = buildDicDataWrite(row);
  if (!payload.ok) {
    message.error(payload.message);
    return false;
  }
  await (row.__is_new
    ? DictionaryApi.createData(payload.data)
    : DictionaryApi.updateData(row.id, payload.data));
  invalidateDictionary(selectedCode.value.code);
  message.success('保存成功');
  await loadDataRows();
  return true;
}

async function deleteDataRow(row: EditableDicData) {
  if (!selectedCode.value) return;
  if (row.__is_new) {
    const rows = dataRows.value.filter((item) => item.id !== row.id);
    await setDataRows(rows);
    return;
  }
  await DictionaryApi.deleteData(row.id);
  invalidateDictionary(selectedCode.value.code);
  message.success('删除成功');
  await loadDataRows();
}

function confirmDeleteDataRow(row: EditableDicData) {
  Modal.confirm({
    async onOk() {
      await deleteDataRow(row);
    },
    okText: '删除',
    okType: 'danger',
    title: `确认删除字典项「${row.label}」？`,
  });
}

function compactJsonValue(row: EditableDicData) {
  try {
    return JSON.stringify(JSON.parse(row.__value_text));
  } catch {
    return row.__value_text;
  }
}

async function initSortable() {
  await nextTick();
  sortable?.destroy();
  sortable = null;
  const body = dataGridApi.grid.$el?.querySelector(
    '.vxe-table--body tbody',
  ) as HTMLElement | null;
  if (!body || !selectedCode.value) return;

  const { initializeSortable } = useSortable(body, {
    handle: '.dictionary-drag-handle',
    async onEnd(event) {
      if (
        event.oldIndex === undefined ||
        event.newIndex === undefined ||
        event.oldIndex === event.newIndex ||
        !selectedCode.value
      ) {
        return;
      }
      const rows = dataGridApi.grid.getTableData()
        .visibleData as EditableDicData[];
      const moved = rows[event.oldIndex];
      if (!moved) return;
      if (moved.__is_new) {
        message.warning('请先保存新增字典项再排序');
        await loadDataRows();
        return;
      }
      await DictionaryApi.reorder({
        id: moved.id,
        sort_no: event.newIndex + 1,
      });
      invalidateDictionary(selectedCode.value.code);
      await loadDataRows();
    },
  });
  sortable = await initializeSortable();
}

onMounted(() => {
  void codeRowContextMenu.bind(codeGridApi.grid);
});

onUnmounted(() => {
  sortable?.destroy();
});
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
    title="字典管理"
  >
    <CodeModal :title="codeModalTitle">
      <CodeForm class="mx-1" />
    </CodeModal>
    <Dropdown
      :menu="dataRowContextMenu.menu.value"
      :open="dataRowContextMenu.open.value"
      :trigger="['click']"
      @open-change="dataRowContextMenu.onOpenChange"
    >
      <span
        class="fixed size-0 overflow-hidden"
        :style="dataRowContextMenu.anchorStyle.value"
      ></span>
    </Dropdown>
    <DataConfigModal :title="dataConfigTitle">
      <div class="flex h-[min(600px,76vh)] min-h-[360px] flex-col gap-2">
        <DataGrid
          class="min-h-0 flex-1"
          :table-data="dataRows"
          table-title="字典项"
        >
          <template #drag="{ row }">
            <GripVertical
              class="dictionary-drag-handle size-4 cursor-grab text-muted-foreground active:cursor-grabbing"
              :class="{ 'cursor-not-allowed opacity-40': row.__is_new }"
            />
          </template>
          <template #label="{ row }">
            <Button
              class="min-w-0 truncate px-0 text-left"
              size="small"
              type="link"
              @click.stop="openDataEdit(row)"
            >
              {{ row.label || '-' }}
            </Button>
          </template>
          <template #value="{ row }">
            <Button
              class="dictionary-value-preview min-w-0 max-w-full truncate px-0 text-left"
              size="small"
              type="link"
              :title="compactJsonValue(row)"
              @click.stop="openDataEdit(row)"
            >
              {{ compactJsonValue(row) }}
            </Button>
          </template>
          <template #is_def="{ row }">
            <Switch
              v-model:checked="row.is_def"
              size="small"
              @change="() => saveDataRow(row)"
            />
          </template>
          <template #toolbar-tools>
            <Space size="small">
              <Button size="small" @click="loadDataRows">刷新</Button>
              <Button size="small" type="primary" @click="openDataCreate">
                <Plus class="size-4" />
                新增字典项
              </Button>
            </Space>
          </template>
        </DataGrid>
      </div>
    </DataConfigModal>
    <DataEditModal :title="dataEditTitle">
      <DataForm class="mx-1" />
    </DataEditModal>

    <CodeGrid class="management-grid" table-title="字典分类">
      <Dropdown
        :menu="codeRowContextMenu.menu.value"
        :open="codeRowContextMenu.open.value"
        :trigger="['click']"
        @open-change="codeRowContextMenu.onOpenChange"
      >
        <span
          class="fixed size-0 overflow-hidden"
          :style="codeRowContextMenu.anchorStyle.value"
        ></span>
      </Dropdown>
      <template #codeCell="{ row }">
        <Button
          class="min-w-0 truncate px-0 text-left"
          size="small"
          type="link"
          @click.stop="openDataConfig(row)"
        >
          {{ row.code }}
        </Button>
      </template>
      <template #codeNameCell="{ row }">
        <Button
          class="min-w-0 truncate px-0 text-left"
          size="small"
          type="link"
          @click.stop="openCodeEdit(row)"
        >
          {{ row.dic_name }}
        </Button>
      </template>
      <template #toolbar-tools>
        <Button type="primary" @click="openCodeCreate">
          <Plus class="size-4" />
          新建
        </Button>
      </template>
    </CodeGrid>
  </Page>
</template>

<style scoped>
.dictionary-value-preview {
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
    monospace;
  font-size: 12px;
}
</style>
