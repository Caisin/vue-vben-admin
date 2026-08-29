<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type {
  VxeTableGridColumns,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';

import { ref } from 'vue';

import { Page } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Badge, Button, message } from 'antdv-next';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import { getList, postSave } from '#/api/res/seas/global/tmplate_lib';

import Modal from './Modal.vue';
import ModalItem from './ModalItem.vue';
import ModalVipItem from './ModalVipItem.vue';
import TmpReviewModal from './TmpReviewModal.vue';

const editOpen = ref(false);
const itemOpen = ref(false);
const vipOpen = ref(false);
const previewOpen = ref(false);
const activeRecord = ref<any>({});

function useGridFormSchema(): VbenFormSchema[] {
  return [
    { component: 'InputNumber', fieldName: 'id.eq', label: 'ID' },
    { component: 'Input', fieldName: 'code_prefix', label: '模板编码' },
  ];
}

function useColumns(): VxeTableGridColumns {
  return [
    { field: 'id', fixed: 'left', title: '模板ID', width: 90 },
    { field: 'name', minWidth: 180, title: '模板名称' },
    {
      field: 'enabled',
      slots: { default: 'enabled' },
      title: '状态',
      width: 90,
    },
    { field: 'remark', minWidth: 220, showOverflow: 'tooltip', title: '备注' },
    { field: 'created_at', title: '时间', width: 170 },
    {
      align: 'right',
      field: 'operation',
      fixed: 'right',
      headerAlign: 'center',
      slots: { default: 'operation' },
      title: '操作',
      width: 220,
    },
  ];
}

function clean(values: Record<string, any>) {
  return Object.fromEntries(
    Object.entries(values).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  );
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: { schema: useGridFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) =>
          getList(
            clean({
              ...formValues,
              page: page.currentPage,
              pageSize: page.pageSize,
            }),
          ),
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
  } as VxeTableGridOptions,
});

function openEdit(record: any = {}) {
  activeRecord.value = record;
  editOpen.value = true;
}

async function saveTemplate(payload: any) {
  await postSave(payload);
  message.success('保存成功');
  editOpen.value = false;
  await gridApi.query();
}

function openModal(kind: 'item' | 'preview' | 'vip', record: any) {
  activeRecord.value = record;
  if (kind === 'item') itemOpen.value = true;
  if (kind === 'vip') vipOpen.value = true;
  if (kind === 'preview') previewOpen.value = true;
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
    title="支付模板库"
  >
    <Grid class="management-grid" table-title="支付模板库">
      <template #toolbar-tools>
        <Button type="primary" @click="openEdit({ enabled: true })">
          <Plus class="size-5" />
          新增
        </Button>
      </template>
      <template #enabled="{ row }">
        <Badge
          :status="row.enabled ? 'success' : 'error'"
          :text="row.enabled ? '启用' : '停用'"
        />
      </template>
      <template #operation="{ row }">
        <VbenTableAction
          :actions="[
            { icon: 'lucide:edit', onClick: () => openEdit(row), text: '编辑' },
            {
              icon: 'lucide:list',
              onClick: () => openModal('item', row),
              text: '模板项',
            },
          ]"
          :dropdown-actions="[
            {
              icon: 'lucide:badge-dollar-sign',
              onClick: () => openModal('vip', row),
              text: 'VIP',
            },
            {
              icon: 'lucide:eye',
              onClick: () => openModal('preview', row),
              text: '预览',
            },
          ]"
          align="center"
        />
      </template>
    </Grid>
    <Modal
      v-model:open="editOpen"
      :record="activeRecord"
      @submit="saveTemplate"
    />
    <ModalItem
      v-model:open="itemOpen"
      item-type="normal"
      :record="activeRecord"
      @success="gridApi.query"
    />
    <ModalVipItem
      v-model:open="vipOpen"
      item-type="vip"
      :record="activeRecord"
      @success="gridApi.query"
    />
    <TmpReviewModal v-model:open="previewOpen" :record="activeRecord" />
  </Page>
</template>
