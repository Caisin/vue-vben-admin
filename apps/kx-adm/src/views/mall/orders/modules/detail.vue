<script lang="ts" setup>
import type {
  MallAdminOrder,
  MallAdminOrderDetailView,
  MallShipmentView,
} from '#/api/mall';

import { computed, h, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import {
  Alert,
  Button,
  Descriptions,
  DescriptionsItem,
  Input,
  message,
  Modal,
  Space,
  Spin,
  Table,
  Tag,
  TextArea,
} from 'antdv-next';

import { MfaApi } from '#/api/core';
import { MallAdminApi } from '#/api/mall';
import { Times } from '#/times';

import { fulfillmentLabel, orderStatusLabel } from '../data';

const emit = defineEmits<{ success: [] }>();

const order = ref<MallAdminOrderDetailView>();
const loading = ref(false);
const revealingAddress = ref(false);
const revealedAddress = ref<string>();
const revealedTracking = ref<Record<string, string>>({});

const drawerTitle = computed(() => `订单详情 - ${order.value?.order_no ?? ''}`);
const canShip = computed(
  () =>
    ['fulfilling', 'paid'].includes(String(order.value?.status)) &&
    order.value?.fulfillment_type === 'physical_delivery',
);
const canReady = computed(
  () =>
    order.value?.status === 'paid' && order.value.fulfillment_type === 'pickup',
);
const canPickup = computed(() => order.value?.status === 'ready_for_pickup');
const canComplete = computed(() =>
  ['fulfilling', 'shipped'].includes(String(order.value?.status)),
);
const canCancel = computed(
  () =>
    ['fulfilling', 'paid', 'ready_for_pickup'].includes(
      String(order.value?.status),
    ) || order.value?.cancelable,
);

const itemColumns = [
  { dataIndex: 'product_name', title: '商品' },
  { dataIndex: 'sku_name', title: 'SKU' },
  { dataIndex: 'quantity', title: '数量', width: 80 },
  { dataIndex: 'points_total', title: '积分', width: 100 },
  { dataIndex: 'fulfillment_summary', title: '履约摘要' },
];

const eventColumns = [
  { dataIndex: 'event_type', title: '事件' },
  { dataIndex: 'remark', title: '备注' },
  { dataIndex: 'created_at', title: '时间' },
];

const [Drawer, drawerApi] = useVbenDrawer<MallAdminOrder>({
  async onOpenChange(open) {
    if (!open) {
      clearPlaintext();
      order.value = undefined;
      return;
    }
    const row = drawerApi.getData();
    if (!row) return;
    await loadOrder(row.id);
  },
});

function clearPlaintext() {
  revealedAddress.value = undefined;
  revealedTracking.value = {};
}

async function loadOrder(id: number | string) {
  loading.value = true;
  try {
    order.value = await MallAdminApi.order(id);
  } finally {
    loading.value = false;
  }
}

async function withReload(
  action: () => Promise<MallAdminOrderDetailView>,
  success: string,
) {
  if (!order.value) return;
  drawerApi.lock();
  try {
    order.value = await action();
    message.success(success);
    emit('success');
  } finally {
    drawerApi.unlock();
  }
}

function shipOrder() {
  const currentOrder = order.value;
  if (!currentOrder) return;
  let carrierName = '';
  let trackingNo = '';
  Modal.confirm({
    content: () =>
      h('div', { class: 'grid gap-3 pt-2' }, [
        h(Input, {
          placeholder: '承运商，例如 顺丰速运',
          'onUpdate:value': (value: string) => {
            carrierName = value;
          },
        }),
        h(Input, {
          placeholder: '物流单号，提交后加密保存',
          'onUpdate:value': (value: string) => {
            trackingNo = value;
          },
        }),
      ]),
    okText: '发货',
    async onOk() {
      if (!carrierName.trim() || !trackingNo.trim()) {
        message.warning('请填写承运商和物流单号');
        throw new Error('tracking_required');
      }
      await withReload(async () => {
        await MallAdminApi.shipOrder(currentOrder.id, {
          carrier: carrierName.trim(),
          items: (currentOrder.items || []).map((item) => ({
            order_item_id: item.id,
            quantity:
              Number(item.quantity) - Number(item.refunded_quantity || 0),
          })),
          tracking_no: trackingNo.trim(),
        });
        return MallAdminApi.order(currentOrder.id);
      }, '订单已发货');
    },
    title: '创建发货单',
  });
}

function readyOrder() {
  const currentOrder = order.value;
  if (!currentOrder) return;
  Modal.confirm({
    content: '确认通知用户到店自提？',
    okText: '设为待自提',
    onOk: () =>
      withReload(async () => {
        await MallAdminApi.readyOrder(currentOrder.id);
        return MallAdminApi.order(currentOrder.id);
      }, '订单已设为待自提'),
    title: '自提准备完成',
  });
}

function pickupOrder() {
  const currentOrder = order.value;
  if (!currentOrder) return;
  let token = '';
  Modal.confirm({
    content: () =>
      h(Input, {
        placeholder: '请输入用户出示的自提凭证',
        'onUpdate:value': (value: string) => {
          token = value;
        },
      }),
    okText: '核销自提',
    async onOk() {
      if (!token.trim()) {
        message.warning('请输入自提凭证');
        throw new Error('pickup_token_required');
      }
      await withReload(async () => {
        await MallAdminApi.pickupOrder(currentOrder.id, token.trim());
        return MallAdminApi.order(currentOrder.id);
      }, '自提已核销');
    },
    title: '核销自提订单',
  });
}

function completeOrder() {
  const currentOrder = order.value;
  if (!currentOrder) return;
  Modal.confirm({
    content: '确认订单已完成履约？',
    okText: '完成订单',
    onOk: () =>
      withReload(async () => {
        await MallAdminApi.completeOrder(currentOrder.id);
        return MallAdminApi.order(currentOrder.id);
      }, '订单已完成'),
    title: '完成订单',
  });
}

function cancelOrder() {
  const currentOrder = order.value;
  if (!currentOrder) return;
  let reason = '';
  Modal.confirm({
    content: () =>
      h(TextArea, {
        placeholder: '取消原因会写入订单事件',
        rows: 3,
        'onUpdate:value': (value?: number | string) => {
          reason = String(value ?? '');
        },
      }),
    okText: '取消订单',
    okType: 'danger',
    onOk: () =>
      withReload(async () => {
        await MallAdminApi.cancelOrder(
          currentOrder.id,
          reason.trim() || '后台取消',
        );
        return MallAdminApi.order(currentOrder.id);
      }, '订单已取消'),
    title: '取消订单',
  });
}

function normalizeCode(value: string) {
  return value.replaceAll(/\D/g, '').slice(0, 6);
}

async function authorize(action: string) {
  let code = '';
  let grant: Awaited<ReturnType<typeof MfaApi.stepUp>> | undefined;
  await new Promise<void>((resolve, reject) => {
    Modal.confirm({
      content: () =>
        h(Input, {
          autocomplete: 'one-time-code',
          inputmode: 'numeric',
          maxlength: 6,
          placeholder: '请输入 6 位 TOTP 验证码',
          'onUpdate:value': (value?: number | string) => {
            code = normalizeCode(String(value ?? ''));
          },
        }),
      okText: '验证',
      onCancel: () => reject(new Error('cancelled')),
      async onOk() {
        if (!/^\d{6}$/.test(code)) {
          message.warning('请输入 6 位验证码');
          throw new Error('totp_required');
        }
        grant = await MfaApi.stepUp({ action, totp_code: code });
        resolve();
      },
      title: '二次验证',
    });
  });
  if (!grant) throw new Error('step_up_required');
  return grant;
}

async function revealAddress() {
  if (!order.value) return;
  revealingAddress.value = true;
  try {
    const grant = await authorize('mall.order_address.reveal');
    const revealed = await MallAdminApi.revealOrderAddress(
      order.value.id,
      grant.grant_token,
    );
    const address = revealed.address;
    revealedAddress.value = `${address.name} ${address.phone} ${address.province}${address.city}${address.district} ${address.detail}`;
  } finally {
    revealingAddress.value = false;
  }
}

async function revealTracking(row: MallShipmentView) {
  const grant = await authorize('mall.shipment_tracking.reveal');
  const revealed = await MallAdminApi.revealShipmentTracking(
    row.id,
    grant.grant_token,
  );
  revealedTracking.value = {
    ...revealedTracking.value,
    [String(row.id)]: `${revealed.carrier_name} ${revealed.tracking_no}`,
  };
}
</script>

<template>
  <Drawer class="w-full max-w-280" :title="drawerTitle">
    <Spin :spinning="loading">
      <div v-if="order" class="mx-4 grid gap-4 pb-4">
        <Space wrap>
          <Button
            v-if="canShip"
            v-access:code="'mall:order:fulfill'"
            type="primary"
            @click="shipOrder"
          >
            发货
          </Button>
          <Button
            v-if="canReady"
            v-access:code="'mall:order:fulfill'"
            @click="readyOrder"
          >
            设为待自提
          </Button>
          <Button
            v-if="canPickup"
            v-access:code="'mall:order:fulfill'"
            @click="pickupOrder"
          >
            核销自提
          </Button>
          <Button
            v-if="canComplete"
            v-access:code="'mall:order:fulfill'"
            @click="completeOrder"
          >
            完成订单
          </Button>
          <Button
            v-if="canCancel"
            v-access:code="'mall:order:cancel'"
            danger
            @click="cancelOrder"
          >
            取消订单
          </Button>
        </Space>

        <Descriptions bordered :column="3" size="small">
          <DescriptionsItem label="订单号">
            {{ order.order_no }}
          </DescriptionsItem>
          <DescriptionsItem label="状态">
            <Tag>{{ orderStatusLabel(order.status) }}</Tag>
          </DescriptionsItem>
          <DescriptionsItem label="履约">
            {{ fulfillmentLabel(order.fulfillment_type) }}
          </DescriptionsItem>
          <DescriptionsItem label="用户 ID">
            {{ order.uid ?? '-' }}
          </DescriptionsItem>
          <DescriptionsItem label="积分">
            {{ order.points_total }}
          </DescriptionsItem>
          <DescriptionsItem label="下单时间">
            {{ Times.formatUnix(order.created_at) }}
          </DescriptionsItem>
        </Descriptions>

        <Alert
          message="地址和物流单号默认只显示脱敏摘要；查看明文需使用对应 action 二次验证，关闭抽屉立即清空。"
          show-icon
          type="warning"
        />
        <div class="rounded border border-border p-3">
          <div class="mb-2 flex items-center gap-3">
            <span class="font-medium">收货地址</span>
            <Button
              v-access:code="'mall:privacy:reveal'"
              :loading="revealingAddress"
              size="small"
              @click="revealAddress"
            >
              查看明文
            </Button>
          </div>
          <div class="text-sm text-muted-foreground">
            {{ revealedAddress || order.address_masked || '无地址摘要' }}
          </div>
        </div>

        <Table
          :columns="itemColumns"
          :data-source="order.items || []"
          :pagination="false"
          row-key="id"
          size="small"
        />

        <div v-if="order.shipments?.length" class="grid gap-2">
          <div class="font-medium">物流</div>
          <div
            v-for="shipment in order.shipments"
            :key="shipment.id"
            class="rounded border border-border p-3 text-sm"
          >
            <div class="flex flex-wrap items-center gap-3">
              <span>{{ shipment.carrier_name }}</span>
              <span>{{
                revealedTracking[String(shipment.id)] ||
                shipment.tracking_no_mask
              }}</span>
              <Button
                v-access:code="'mall:privacy:reveal'"
                size="small"
                @click="revealTracking(shipment)"
              >
                查看物流单号
              </Button>
            </div>
            <div class="mt-1 text-muted-foreground">
              {{ shipment.status }} · 发货
              {{ Times.formatOptionalUnix(shipment.shipped_at) }}
            </div>
          </div>
        </div>

        <Table
          :columns="eventColumns"
          :data-source="order.events || []"
          :pagination="false"
          row-key="id"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'created_at'">
              {{ Times.formatUnix(record.created_at) }}
            </template>
          </template>
        </Table>
      </div>
    </Spin>
  </Drawer>
</template>
