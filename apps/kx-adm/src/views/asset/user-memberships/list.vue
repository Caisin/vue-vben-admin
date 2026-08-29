<script lang="ts" setup>
import type { MembershipRow } from './data';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { MembershipGrantWrite, MembershipRevokeWrite } from '#/api';

import { nextTick, ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { CircleX, Plus } from '@vben/icons';

import { Button, message, Space } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { MembershipApi } from '#/api';

import { useColumns, useFormSchema } from './data';
import ContentModal from './modules/modal.vue';

const currentAcctId = ref<number | string>();

const commonSourceFields = [
  {
    component: 'Input' as const,
    defaultValue: 'manual_admin',
    fieldName: 'source_type',
    label: '来源类型',
    rules: 'required' as const,
  },
  {
    component: 'Input' as const,
    fieldName: 'source_id',
    label: '来源记录 ID',
    rules: 'required' as const,
  },
  {
    component: 'Input' as const,
    fieldName: 'idempotency_key',
    label: '幂等键',
    rules: 'required' as const,
  },
  {
    component: 'Textarea' as const,
    componentProps: { autoSize: { maxRows: 6, minRows: 3 } },
    fieldName: 'reason',
    formItemClass: 'md:col-span-2 lg:col-span-3',
    label: '操作原因',
    rules: 'required' as const,
  },
  {
    component: 'Textarea' as const,
    componentProps: { autoSize: { maxRows: 6, minRows: 3 } },
    defaultValue: '{}',
    fieldName: 'metadata',
    formItemClass: 'md:col-span-2 lg:col-span-3',
    label: '附加元数据 JSON',
  },
];

const [GrantForm, grantFormApi] = useVbenForm({
  layout: 'vertical',
  wrapperClass: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  schema: [
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full', min: 1 },
      fieldName: 'plan_id',
      formItemClass: 'col-span-1',
      label: '会员计划 ID',
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full', min: 1 },
      fieldName: 'duration_seconds',
      formItemClass: 'col-span-1',
      label: '有效秒数',
      rules: 'required',
    },
    ...commonSourceFields,
  ],
  showDefaultActions: false,
});

const [RevokeForm, revokeFormApi] = useVbenForm({
  layout: 'vertical',
  wrapperClass: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  schema: [
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full', min: 1 },
      fieldName: 'membership_type_id',
      formItemClass: 'col-span-1',
      label: '会员类型 ID',
      rules: 'required',
    },
    ...commonSourceFields,
  ],
  showDefaultActions: false,
});

function parseMetadata(values: Record<string, unknown>) {
  const metadata = values.metadata;
  return {
    ...values,
    metadata: typeof metadata === 'string' ? JSON.parse(metadata) : metadata,
  };
}

const [GrantModal, grantModalApi] = useVbenModal({
  connectedComponent: ContentModal,
  destroyOnClose: true,
  async onConfirm() {
    const { valid } = await grantFormApi.validate();
    if (!valid || currentAcctId.value === undefined) return;
    grantModalApi.lock();
    try {
      const values = parseMetadata(await grantFormApi.getValues());
      await MembershipApi.grant(
        currentAcctId.value,
        values as unknown as MembershipGrantWrite,
      );
      message.success('会员发放成功');
      grantModalApi.close();
      await gridApi.query();
    } catch (error) {
      if (error instanceof SyntaxError) {
        message.error('附加元数据 JSON 格式不正确');
        return;
      }
      throw error;
    } finally {
      grantModalApi.lock(false);
    }
  },
});

const [RevokeModal, revokeModalApi] = useVbenModal({
  connectedComponent: ContentModal,
  destroyOnClose: true,
  async onConfirm() {
    const { valid } = await revokeFormApi.validate();
    if (!valid || currentAcctId.value === undefined) return;
    revokeModalApi.lock();
    try {
      const values = parseMetadata(await revokeFormApi.getValues());
      await MembershipApi.revoke(
        currentAcctId.value,
        values as unknown as MembershipRevokeWrite,
      );
      message.success('会员撤销成功');
      revokeModalApi.close();
      await gridApi.query();
    } catch (error) {
      if (error instanceof SyntaxError) {
        message.error('附加元数据 JSON 格式不正确');
        return;
      }
      throw error;
    } finally {
      revokeModalApi.lock(false);
    }
  },
});

const [Grid, gridApi] = useVbenVxeGrid<MembershipRow>({
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
          const memberships = await MembershipApi.summary(currentAcctId.value);
          const items = memberships.map((item) => ({
            ...item,
            row_key: String(item.membership.membership_type_id),
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
  } as VxeTableGridOptions<MembershipRow>,
});

async function prepareForm(
  formApi: typeof grantFormApi | typeof revokeFormApi,
  operation: 'grant' | 'revoke',
) {
  if (currentAcctId.value === undefined) {
    message.warning('请先查询账户会员');
    return false;
  }
  const timestamp = Date.now();
  await formApi.reset();
  await formApi.setValues({
    idempotency_key: `admin-membership-${operation}-${currentAcctId.value}-${timestamp}`,
    metadata: '{}',
    source_id: `manual-${timestamp}`,
    source_type: 'manual_admin',
  });
  return true;
}

async function openGrant() {
  if (currentAcctId.value === undefined) {
    message.warning('请先查询账户会员');
    return;
  }
  grantModalApi.open();
  await nextTick();
  if (!(await prepareForm(grantFormApi, 'grant'))) grantModalApi.close();
}

async function openRevoke() {
  if (currentAcctId.value === undefined) {
    message.warning('请先查询账户会员');
    return;
  }
  revokeModalApi.open();
  await nextTick();
  if (!(await prepareForm(revokeFormApi, 'revoke'))) revokeModalApi.close();
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
    title="账户会员"
  >
    <GrantModal title="发放会员">
      <GrantForm class="mx-1" />
    </GrantModal>
    <RevokeModal title="撤销会员">
      <RevokeForm class="mx-1" />
    </RevokeModal>

    <Grid class="management-grid" table-title="账户会员状态">
      <template #toolbar-tools>
        <Space size="small">
          <Button type="primary" @click="openGrant">
            <Plus class="size-4" />
            发放
          </Button>
          <Button danger @click="openRevoke">
            <CircleX class="size-4" />
            撤销
          </Button>
        </Space>
      </template>
    </Grid>
  </Page>
</template>
