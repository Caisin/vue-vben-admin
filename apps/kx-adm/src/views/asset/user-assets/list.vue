<script lang="ts" setup>
import type { BalanceRow } from './data';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { BalanceGrantWrite, BalanceSpendWrite } from '#/api';

import { nextTick, ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus, SquareMinus } from '@vben/icons';

import { Button, message, Space } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { AssetApi } from '#/api';

import { useColumns, useFormSchema } from './data';
import ContentModal from './modules/modal.vue';

type BalanceOperation = 'grant' | 'spend';

const currentAcctId = ref<number | string>();
const operation = ref<BalanceOperation>('grant');

const [OperationForm, operationFormApi] = useVbenForm({
  layout: 'vertical',
  wrapperClass: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  schema: [
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full', min: 1 },
      fieldName: 'asset_item_id',
      formItemClass: 'col-span-1',
      label: '资产科目 ID',
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full', min: 1 },
      fieldName: 'amount',
      formItemClass: 'col-span-1',
      label: '数量',
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full', min: 1 },
      fieldName: 'valid_seconds',
      formItemClass: 'col-span-1',
      label: '有效秒数',
    },
    {
      component: 'Input',
      defaultValue: 'manual_admin',
      fieldName: 'source_type',
      formItemClass: 'col-span-1',
      label: '来源类型',
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'source_id',
      formItemClass: 'col-span-1',
      label: '来源记录 ID',
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'idempotency_key',
      formItemClass: 'col-span-1',
      label: '幂等键',
      rules: 'required',
    },
    {
      component: 'Textarea',
      componentProps: { autoSize: { maxRows: 6, minRows: 3 } },
      fieldName: 'reason',
      formItemClass: 'md:col-span-2 lg:col-span-3',
      label: '操作原因',
    },
  ],
  showDefaultActions: false,
});

const [OperationModal, operationModalApi] = useVbenModal({
  connectedComponent: ContentModal,
  destroyOnClose: true,
  async onConfirm() {
    const { valid } = await operationFormApi.validate();
    if (!valid || currentAcctId.value === undefined) return;

    operationModalApi.lock();
    try {
      const values = await operationFormApi.getValues();
      if (operation.value === 'grant') {
        await AssetApi.grant(
          currentAcctId.value,
          values as unknown as BalanceGrantWrite,
        );
        message.success('资产发放成功');
      } else {
        const { valid_seconds: _valid_seconds, ...spendValues } = values;
        await AssetApi.spend(
          currentAcctId.value,
          spendValues as unknown as BalanceSpendWrite,
        );
        message.success('资产扣减成功');
      }
      operationModalApi.close();
      await gridApi.query();
    } finally {
      operationModalApi.lock(false);
    }
  },
});

const [Grid, gridApi] = useVbenVxeGrid<BalanceRow>({
  formOptions: {
    schema: useFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    pagerConfig: { enabled: false },
    proxyConfig: {
      ajax: {
        query: async (_params, formValues) => {
          const acctId = formValues.acct_id as number | string | undefined;
          currentAcctId.value = acctId || undefined;
          if (!currentAcctId.value) return { items: [], total: 0 };
          const balances = await AssetApi.balances(currentAcctId.value);
          const items = balances.map((item) => ({
            ...item,
            row_key: String(item.asset_item.id),
          }));
          return { items, total: items.length };
        },
      },
    },
    rowConfig: { keyField: 'row_key' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<BalanceRow>,
});

async function openOperation(nextOperation: BalanceOperation) {
  if (currentAcctId.value === undefined) {
    message.warning('请先查询资金账户');
    return;
  }
  operation.value = nextOperation;
  const timestamp = Date.now();
  operationModalApi.open();
  await nextTick();
  await operationFormApi.reset();
  await operationFormApi.setValues({
    idempotency_key: `admin-${nextOperation}-${currentAcctId.value}-${timestamp}`,
    source_id: `manual-${timestamp}`,
    source_type: 'manual_admin',
  });
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
    title="账户资产"
  >
    <OperationModal :title="operation === 'grant' ? '发放资产' : '扣减资产'">
      <OperationForm class="mx-1" />
    </OperationModal>

    <Grid class="management-grid" table-title="账户资产余额">
      <template #toolbar-tools>
        <Space size="small">
          <Button type="primary" @click="openOperation('grant')">
            <Plus class="size-4" />
            发放
          </Button>
          <Button danger @click="openOperation('spend')">
            <SquareMinus class="size-4" />
            扣减
          </Button>
        </Space>
      </template>
    </Grid>
  </Page>
</template>
