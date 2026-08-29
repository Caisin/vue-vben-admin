<script lang="ts" setup>
import type { MallAfterSaleDetailView, MallAfterSaleView } from '#/api/mall';

import { computed, h, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import {
  Button,
  Checkbox,
  Descriptions,
  DescriptionsItem,
  Input,
  message,
  Modal,
  Space,
  Table,
  Tag,
  TextArea,
} from 'antdv-next';

import { MallAdminApi } from '#/api/mall';
import { Times } from '#/times';

import { afterSaleStatusLabel } from '../data';

const emit = defineEmits<{ success: [] }>();

const detail = ref<MallAfterSaleDetailView>();
const title = computed(
  () => `售后详情 - ${detail.value?.after_sale.after_sale_no ?? ''}`,
);
const canReview = computed(
  () => detail.value?.after_sale.status === 'requested',
);
const canReceive = computed(
  () => detail.value?.after_sale.status === 'returning',
);
const canRefund = computed(() =>
  ['approved', 'received'].includes(String(detail.value?.after_sale.status)),
);

const columns = [
  { dataIndex: 'order_item_id', title: '订单明细' },
  { dataIndex: 'quantity', title: '数量' },
  { dataIndex: 'points_refund', title: '退款积分' },
];

const [Drawer, drawerApi] = useVbenDrawer<MallAfterSaleView>({
  async onOpenChange(open) {
    if (!open) {
      detail.value = undefined;
      return;
    }
    const row = drawerApi.getData();
    if (!row) return;
    detail.value = await MallAdminApi.afterSale(row.id);
  },
});

async function reload() {
  if (detail.value)
    detail.value = await MallAdminApi.afterSale(detail.value.after_sale.id);
  emit('success');
}

function review(approved: boolean) {
  const currentDetail = detail.value;
  if (!currentDetail) return;
  let remark = '';
  Modal.confirm({
    content: () =>
      h(TextArea, {
        placeholder: approved ? '审核备注' : '拒绝原因',
        rows: 3,
        'onUpdate:value': (value?: number | string) => {
          remark = String(value ?? '');
        },
      }),
    okText: approved ? '通过' : '拒绝',
    okType: approved ? 'primary' : 'danger',
    async onOk() {
      if (!approved && !remark.trim()) throw new Error('remark_required');
      await (approved
        ? MallAdminApi.approveAfterSale(currentDetail.after_sale.id, {
            remark: remark.trim(),
          })
        : MallAdminApi.rejectAfterSale(currentDetail.after_sale.id, {
            remark: remark.trim(),
          }));
      message.success('操作成功');
      await reload();
    },
    title: approved ? '审核通过售后' : '拒绝售后',
  });
}

function receive() {
  const currentDetail = detail.value;
  if (!currentDetail) return;
  Modal.confirm({
    content: '确认已收到用户退货？确认后会进入原路退款。',
    okText: '确认收货',
    onOk: async () => {
      await MallAdminApi.receiveAfterSale(currentDetail.after_sale.id);
      message.success('已确认收货');
      await reload();
    },
    title: '售后收货',
  });
}

function refund() {
  const currentDetail = detail.value;
  if (!currentDetail) return;
  let reason = '';
  let forceVirtualRefund = false;
  Modal.confirm({
    content: () =>
      h(Space, { direction: 'vertical', class: 'w-full' }, () => [
        h(
          Checkbox,
          {
            'onUpdate:checked': (value: boolean) => {
              forceVirtualRefund = value;
            },
          },
          () => '强制退款已查看的虚拟码',
        ),
        h(Input, {
          placeholder: '强制虚拟码退款时必须填写原因',
          'onUpdate:value': (value?: number | string) => {
            reason = String(value ?? '');
          },
        }),
      ]),
    okText: '执行退款',
    async onOk() {
      if (forceVirtualRefund && !reason.trim())
        throw new Error('reason_required');
      await MallAdminApi.refundAfterSale(currentDetail.after_sale.id, {
        force_virtual_refund: forceVirtualRefund,
        reason: reason.trim(),
      });
      message.success('退款已提交');
      await reload();
    },
    title: '执行售后退款',
  });
}
</script>

<template>
  <Drawer :title="title" class="w-[720px]">
    <template v-if="detail">
      <Descriptions bordered size="small">
        <DescriptionsItem label="状态">
          <Tag>{{ afterSaleStatusLabel(detail.after_sale.status) }}</Tag>
        </DescriptionsItem>
        <DescriptionsItem label="订单 ID">
          {{ detail.after_sale.order_id }}
        </DescriptionsItem>
        <DescriptionsItem label="用户 ID">
          {{ detail.after_sale.user_id }}
        </DescriptionsItem>
        <DescriptionsItem label="退款积分">
          {{ detail.after_sale.refund_points }}
        </DescriptionsItem>
        <DescriptionsItem label="退货">
          {{ detail.after_sale.return_required ? '需要退货' : '仅退款' }}
        </DescriptionsItem>
        <DescriptionsItem label="申请时间">
          {{ Times.formatUnix(detail.after_sale.created_at) }}
        </DescriptionsItem>
        <DescriptionsItem label="备注" :span="3">
          {{ detail.after_sale.description_summary || '-' }}
        </DescriptionsItem>
      </Descriptions>
      <Table
        class="mt-4"
        :columns="columns"
        :data-source="detail.items"
        :pagination="false"
        row-key="id"
        size="small"
      />
      <Space class="mt-4">
        <Button v-if="canReview" type="primary" @click="review(true)">
          审核通过
        </Button>
        <Button v-if="canReview" danger @click="review(false)">拒绝</Button>
        <Button v-if="canReceive" type="primary" @click="receive">
          确认收货
        </Button>
        <Button v-if="canRefund" danger @click="refund">执行退款</Button>
      </Space>
    </template>
  </Drawer>
</template>
