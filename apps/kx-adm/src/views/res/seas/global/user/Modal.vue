<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  RuntimeUser,
  RuntimeUserDetail,
} from '#/api/res/seas/global/user';

import { computed, nextTick, reactive, ref, watch } from 'vue';

import {
  Button,
  Descriptions,
  DescriptionsItem,
  Empty,
  Form,
  FormItem,
  Image,
  Input,
  Modal,
  Select,
  Space,
  TabPane,
  Tabs,
  Tag,
} from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  getConsumeLogList,
  getFireBaseList,
  getOrderList,
  getSubDetailList,
  getSubList,
  getUserDetail,
  getUserLinkList,
} from '#/api/res/seas/global/user';

const props = defineProps<{
  open: boolean;
  user?: null | RuntimeUser;
}>();
const emit = defineEmits<{ 'update:open': [boolean] }>();

const detailLoading = ref(false);
const detail = ref<RuntimeUserDetail>({});
const activeTab = ref('orders');

const filters = reactive<Record<string, any>>({
  consume: { end: '', res_id: undefined, start: '' },
  links: { ad_id: '', link_id: undefined, state: undefined },
  orders: { end: '', idempotency_key: '', start: '', state: undefined },
  read: { res_id: undefined, state: undefined },
  readDetail: {
    item_id: undefined,
    res_id: undefined,
    state: undefined,
    stat_day: undefined,
  },
  tokens: {},
});

const tables = reactive<Record<string, any>>({
  consume: state(),
  links: state(),
  orders: state(),
  read: state(),
  readDetail: state(),
  tokens: state(),
});

const orderColumns = [
  { field: 'id', title: '订单ID', width: 100 },
  {
    field: 'provider_order_id',
    title: '支付平台订单ID',
    width: 190,
  },
  { field: 'amount', slots: { default: 'amount' }, title: '金额', width: 100 },
  {
    field: 'item_type',
    slots: { default: 'itemType' },
    title: '充值模板类型',
    width: 130,
  },
  {
    field: 'benefit',
    slots: { default: 'benefit' },
    title: '权益',
    width: 140,
  },
  { field: 'provider', title: '渠道', width: 110 },
  { field: 'state', slots: { default: 'state' }, title: '状态', width: 100 },
  { field: 'content_id', title: '剧ID', width: 90 },
  { field: 'episode_id', title: '章节ID', width: 90 },
  {
    field: 'created_at',
    slots: { default: 'createdAt' },
    title: '时间',
    width: 180,
  },
  { field: 'client_ip', title: 'IP', width: 130 },
  { field: 'remark', title: '备注', width: 180 },
];
const consumeColumns = [
  { field: 'res_id', title: '剧ID', width: 90 },
  { field: 'res_name', title: '剧名称', width: 180 },
  { field: 'cover', slots: { default: 'cover' }, title: '剧封面', width: 90 },
  { field: 'item_id', title: '章节ID', width: 90 },
  { field: 'seq_no', title: '第几集', width: 90 },
  {
    field: 'buy_type',
    slots: { default: 'buyType' },
    title: '购买类型',
    width: 120,
  },
  { field: 'amount', title: '金额', width: 90 },
  { field: 'lang', title: '语言', width: 90 },
  {
    field: 'created_at',
    slots: { default: 'createdAt' },
    title: '时间',
    width: 180,
  },
];
const readColumns = [
  { field: 'res_id', title: '剧ID', width: 90 },
  { field: 'res_name', title: '剧名称', width: 180 },
  { field: 'cover', slots: { default: 'cover' }, title: '剧封面', width: 90 },
  {
    field: 'last_item_id',
    title: '最后章节ID',
    width: 110,
  },
  { field: 'seq_no', title: '第几集', width: 90 },
  { field: 'read_times', title: '阅读次数', width: 100 },
  { field: 'state', slots: { default: 'state' }, title: '状态', width: 90 },
  {
    field: 'update_at',
    slots: { default: 'updatedAt' },
    title: '更新时间',
    width: 180,
  },
];
const readDetailColumns = [
  { field: 'res_id', title: '剧ID', width: 90 },
  { field: 'res_name', title: '剧名称', width: 180 },
  { field: 'cover', slots: { default: 'cover' }, title: '剧封面', width: 90 },
  { field: 'item_id', title: '章节ID', width: 90 },
  { field: 'item_name', title: '章节名', width: 160 },
  { field: 'seq_no', title: '第几集', width: 90 },
  { field: 'read_times', title: '阅读次数', width: 100 },
  { field: 'stat_day', title: '统计日', width: 110 },
  { field: 'state', slots: { default: 'state' }, title: '状态', width: 90 },
  {
    field: 'created_at',
    slots: { default: 'createdAt' },
    title: '时间',
    width: 180,
  },
];
const linkColumns = [
  { field: 'id', title: 'ID', width: 80 },
  { field: 'link_id', title: '推广链接ID', width: 120 },
  {
    field: 'link_name',
    title: '推广链接名称',
    width: 150,
  },
  {
    field: 'fb_pixel_id',
    title: 'Pixel ID',
    width: 150,
  },
  { field: 'referer', title: '链接', width: 260 },
  { field: 'state', slots: { default: 'state' }, title: '状态', width: 110 },
  {
    field: 'create_time',
    slots: { default: 'createdAt' },
    title: '进入时间',
    width: 180,
  },
  {
    field: 'update_time',
    slots: { default: 'updatedAt' },
    title: '变化时间',
    width: 180,
  },
  { field: 'ad_id', title: 'ad_id', width: 120 },
  {
    field: 'campaign_name',
    title: 'campaign_name',
    width: 160,
  },
  { field: 'bx_type', title: '变现类型', width: 100 },
  { field: 'ua', title: 'UA', width: 260 },
];
const tokenColumns = [
  { field: 'id', title: 'ID', width: 90 },
  { field: 'uid', title: '用户ID', width: 100 },
  {
    field: 'endpoint',
    title: 'Firebase Token',
    width: 360,
  },
  { field: 'platform', title: '平台', width: 100 },
  { field: 'current', slots: { default: 'current' }, title: '当前', width: 90 },
  {
    field: 'updated_at',
    slots: { default: 'updatedAt' },
    title: '更新时间',
    width: 180,
  },
];

const orderStateOptions = [
  { label: '待付款', value: 'pending' },
  { label: '已付款', value: 'paid' },
  { label: '已退款', value: 'refunded' },
  { label: '已取消', value: 'cancelled' },
];
const normalStateOptions = [
  { label: '正常/当前', value: 1 },
  { label: '删除/历史', value: 0 },
];

function createPagedGrid(
  tab: string,
  columns: VxeTableGridOptions['columns'],
  keyField = 'id',
) {
  return useVbenVxeGrid({
    gridEvents: {
      pageChange: ({
        currentPage,
        pageSize,
      }: {
        currentPage: number;
        pageSize: number;
      }) => {
        onTableChange(tab, { current: currentPage, pageSize });
      },
    },
    gridOptions: {
      columns,
      height: 520,
      pagerConfig: { pageSize: 10, pageSizes: [10, 20, 50, 100] },
      rowConfig: { keyField },
      toolbarConfig: { enabled: false },
    } as VxeTableGridOptions,
  });
}

function createOverviewGrid(
  rows: () => any[],
  columns: VxeTableGridOptions['columns'],
  keyField: string,
) {
  return useVbenVxeGrid({
    gridOptions: {
      columns,
      height: 360,
      pagerConfig: { enabled: false },
      proxyConfig: {
        ajax: { query: async () => ({ items: rows(), total: rows().length }) },
      },
      rowConfig: { keyField },
      toolbarConfig: { enabled: false },
    } as VxeTableGridOptions,
  });
}

const [OrderGrid, orderGridApi] = createPagedGrid('orders', orderColumns);
const [ConsumeGrid, consumeGridApi] = createPagedGrid(
  'consume',
  consumeColumns,
);
const [ReadGrid, readGridApi] = createPagedGrid('read', readColumns, 'res_id');
const [ReadDetailGrid, readDetailGridApi] = createPagedGrid(
  'readDetail',
  readDetailColumns,
);
const [LinkGrid, linkGridApi] = createPagedGrid('links', linkColumns);
const [TokenGrid, tokenGridApi] = createPagedGrid('tokens', tokenColumns);
const [CurrentLinkGrid] = createOverviewGrid(
  () => detail.value.current_links ?? [],
  linkColumns,
  'id',
);
const [ReadHistoryGrid] = createOverviewGrid(
  () => detail.value.read_history ?? [],
  readColumns,
  'res_id',
);

function detailGridApi(tab: string) {
  switch (tab) {
    case 'consume': {
      return consumeGridApi;
    }
    case 'links': {
      return linkGridApi;
    }
    case 'orders': {
      return orderGridApi;
    }
    case 'read': {
      return readGridApi;
    }
    case 'readDetail': {
      return readDetailGridApi;
    }
    case 'tokens': {
      return tokenGridApi;
    }
    default: {
      return undefined;
    }
  }
}

const uid = computed(() => props.user?.id);
const userInfo = computed<any>(() => detail.value.user ?? props.user ?? {});

function state() {
  return {
    loading: false,
    rows: [] as any[],
    total: 0,
    pagination: { current: 1, pageSize: 10 },
  };
}

function pageItems(payload: any): any[] {
  return Array.isArray(payload) ? payload : (payload?.items ?? []);
}

function pageTotal(payload: any, items: unknown[]) {
  return Number(payload?.total ?? items.length);
}

function dayStart(day: string) {
  return day
    ? Math.floor(new Date(`${day}T00:00:00`).getTime() / 1000)
    : undefined;
}
function dayEnd(day: string) {
  return day
    ? Math.floor(new Date(`${day}T23:59:59`).getTime() / 1000)
    : undefined;
}
function clean(params: Record<string, any>) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== '' && value !== null,
    ),
  );
}
function withUid(extra: Record<string, any>, key = 'uid') {
  return clean({ [key]: uid.value, ...extra });
}

async function loadDetail() {
  if (!uid.value) return;
  detailLoading.value = true;
  try {
    detail.value = await getUserDetail({ uid: { eq: uid.value } });
  } finally {
    detailLoading.value = false;
  }
}

async function loadTable(tab = activeTab.value) {
  if (!uid.value) return;
  const cfg = tables[tab];
  const gridApi = detailGridApi(tab);
  cfg.loading = true;
  gridApi?.setLoading(true);
  try {
    let payload: any;
    const page = {
      page: cfg.pagination.current,
      pageSize: cfg.pagination.pageSize,
    };
    if (tab === 'orders') {
      payload = await getOrderList(
        withUid({
          ...page,
          created_end: dayEnd(filters.orders.end),
          created_start: dayStart(filters.orders.start),
          idempotency_key: filters.orders.idempotency_key?.trim(),
          state: filters.orders.state,
        }),
      );
    } else if (tab === 'consume') {
      payload = await getConsumeLogList(
        withUid({
          ...page,
          created_end: dayEnd(filters.consume.end),
          created_start: dayStart(filters.consume.start),
          res_id: filters.consume.res_id,
        }),
      );
    } else if (tab === 'read') {
      payload = await getSubList(
        withUid({
          ...page,
          res_id: filters.read.res_id,
          state: filters.read.state,
        }),
      );
    } else if (tab === 'readDetail') {
      payload = await getSubDetailList(
        withUid({
          ...page,
          item_id: filters.readDetail.item_id,
          res_id: filters.readDetail.res_id,
          state: filters.readDetail.state,
          stat_day: filters.readDetail.stat_day,
        }),
      );
    } else if (tab === 'links') {
      payload = await getUserLinkList(
        withUid({
          ...page,
          ad_id: filters.links.ad_id?.trim(),
          link_id: filters.links.link_id,
          state: filters.links.state,
        }),
      );
    } else if (tab === 'tokens') {
      payload = await getFireBaseList(withUid(page));
    }
    const items = pageItems(payload);
    cfg.rows = items;
    cfg.total = pageTotal(payload, items);
    await nextTick();
    gridApi?.setGridOptions({
      pagerConfig: {
        currentPage: cfg.pagination.current,
        pageSize: cfg.pagination.pageSize,
        total: cfg.total,
      },
    });
    await gridApi?.grid.reloadData(items);
  } finally {
    cfg.loading = false;
    gridApi?.setLoading(false);
  }
}

function search(tab = activeTab.value) {
  tables[tab].pagination.current = 1;
  loadTable(tab);
}

function onTableChange(tab: string, page: any) {
  tables[tab].pagination.current = page.current;
  tables[tab].pagination.pageSize = page.pageSize;
  loadTable(tab);
}

function close() {
  emit('update:open', false);
}

function formatTime(value?: number | string) {
  if (!value) return '-';
  const numeric = Number(value);
  if (Number.isFinite(numeric))
    return new Date(numeric * 1000).toLocaleString();
  return String(value);
}
function formatMoneyMinor(value?: number | string) {
  const amount = Number(value ?? 0) / 100;
  return amount
    ? amount.toLocaleString(undefined, {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      })
    : '0.00';
}
function product(row: any) {
  return row.product_snapshot ?? row.pay_item_info ?? {};
}
function orderAmount(row: any) {
  return row.pay_amount ?? row.amount_minor ?? product(row).amount_minor;
}
function itemType(row: any) {
  return row.item_type ?? product(row).item_type ?? '-';
}
function orderBenefit(row: any) {
  const snapshot = product(row);
  if (snapshot.unlock_episode_count)
    return `${snapshot.unlock_episode_count}章`;
  if (
    Array.isArray(snapshot.balance_grants) &&
    snapshot.balance_grants.length > 0
  ) {
    return snapshot.balance_grants
      .map((item: any) => `${item.quantity ?? 0}金币`)
      .join(' / ');
  }
  if (
    Array.isArray(snapshot.membership_grants) &&
    snapshot.membership_grants.length > 0
  )
    return '会员';
  return '-';
}
function orderStateText(value: string) {
  return (
    orderStateOptions.find((item) => item.value === value)?.label ??
    value ??
    '-'
  );
}
function buyTypeText(value: number | string) {
  const map: Record<string, string> = {
    '0': '单集购买',
    '1': '整剧/本购买',
    '2': '广告解锁',
    '3': 'FB关注解锁',
  };
  return map[String(value)] ?? String(value ?? '-');
}
function boolText(value: unknown) {
  return value ? '是' : '否';
}
function imageSrc(record: any) {
  return record.cover || record.avatar || undefined;
}
function valueOf(record: unknown, key: string) {
  return (record as Record<string, any> | undefined)?.[key];
}
function stateOf(record: unknown) {
  return valueOf(record, 'state');
}
function currentOf(record: unknown) {
  return Boolean(valueOf(record, 'current'));
}
function timeOf(record: unknown, ...keys: string[]) {
  for (const key of keys) {
    const value = valueOf(record, key);
    if (value) return value;
  }
  return undefined;
}

watch(
  () => props.open,
  async (open) => {
    if (!open || !uid.value) return;
    activeTab.value = 'orders';
    await loadDetail();
    await loadTable('orders');
  },
);
</script>

<template>
  <Modal
    :open="open"
    title="用户详情"
    width="1200px"
    :footer="null"
    destroy-on-close
    @cancel="close"
  >
    <div class="space-y-4">
      <Descriptions :column="3" :loading="detailLoading" bordered size="small">
        <DescriptionsItem label="用户ID">{{ userInfo.id }}</DescriptionsItem>
        <DescriptionsItem label="用户名">
          {{ userInfo.name || userInfo.user_name || '-' }}
        </DescriptionsItem>
        <DescriptionsItem label="账号ID">
          {{ userInfo.acct_id ?? '-' }}
        </DescriptionsItem>
        <DescriptionsItem label="平台">
          {{ userInfo.platform || '-' }}
        </DescriptionsItem>
        <DescriptionsItem label="操作系统">
          {{ userInfo.os || '-' }}
        </DescriptionsItem>
        <DescriptionsItem label="注册IP">
          {{ userInfo.reg_ip || '-' }}
        </DescriptionsItem>
        <DescriptionsItem label="游客">
          <Tag
            :color="userInfo.is_guest || userInfo.guest === 1 ? 'red' : 'green'"
          >
            {{ userInfo.is_guest || userInfo.guest === 1 ? '是' : '否' }}
          </Tag>
        </DescriptionsItem>
        <DescriptionsItem label="状态">
          <Tag :color="userInfo.enabled === false ? 'red' : 'green'">
            {{ userInfo.enabled === false ? '禁用' : '正常' }}
          </Tag>
        </DescriptionsItem>
        <DescriptionsItem label="注册时间">
          {{ formatTime(userInfo.created_at) }}
        </DescriptionsItem>
        <DescriptionsItem label="邮箱">
          {{ userInfo.email || '-' }}
        </DescriptionsItem>
        <DescriptionsItem label="手机号">
          {{ userInfo.tel || userInfo.phone || '-' }}
        </DescriptionsItem>
        <DescriptionsItem label="备注">
          {{ userInfo.remark || '-' }}
        </DescriptionsItem>
      </Descriptions>

      <Tabs
        v-model:active-key="activeTab"
        destroy-inactive-tab-pane
        @change="(key) => loadTable(String(key))"
      >
        <TabPane key="orders" tab="充值记录">
          <Form layout="inline" class="mb-3">
            <FormItem label="订单幂等键">
              <Input
                v-model:value="filters.orders.idempotency_key"
                allow-clear
                class="w-48"
              />
            </FormItem>
            <FormItem label="状态">
              <Select
                v-model:value="filters.orders.state"
                allow-clear
                :options="orderStateOptions"
                class="w-36"
              />
            </FormItem>
            <FormItem label="开始">
              <Input v-model:value="filters.orders.start" type="date" />
            </FormItem>
            <FormItem label="结束">
              <Input v-model:value="filters.orders.end" type="date" />
            </FormItem>
            <FormItem>
              <Space>
                <Button type="primary" @click="search('orders')"> 查询 </Button>
              </Space>
            </FormItem>
          </Form>
          <OrderGrid>
            <template #amount="{ row }">
              {{ formatMoneyMinor(orderAmount(row)) }}
            </template>
            <template #itemType="{ row }">
              <Tag color="blue">{{ itemType(row) }}</Tag>
            </template>
            <template #benefit="{ row }">{{ orderBenefit(row) }}</template>
            <template #state="{ row }">
              <Tag
                :color="
                  stateOf(row) === 'paid'
                    ? 'green'
                    : stateOf(row) === 'refunded'
                      ? 'orange'
                      : 'default'
                "
              >
                {{ orderStateText(stateOf(row)) }}
              </Tag>
            </template>
            <template #createdAt="{ row }">
              {{ formatTime(timeOf(row, 'created_at')) }}
            </template>
          </OrderGrid>
        </TabPane>

        <TabPane key="consume" tab="消费记录">
          <Form layout="inline" class="mb-3">
            <FormItem label="剧ID">
              <Input
                v-model:value="filters.consume.res_id"
                allow-clear
                class="w-32"
              />
            </FormItem>
            <FormItem label="开始">
              <Input v-model:value="filters.consume.start" type="date" />
            </FormItem>
            <FormItem label="结束">
              <Input v-model:value="filters.consume.end" type="date" />
            </FormItem>
            <FormItem>
              <Button type="primary" @click="search('consume')"> 查询 </Button>
            </FormItem>
          </Form>
          <ConsumeGrid>
            <template #cover="{ row }">
              <Image v-if="imageSrc(row)" :src="imageSrc(row)" :height="56" />
            </template>
            <template #buyType="{ row }">
              {{ buyTypeText(valueOf(row, 'buy_type')) }}
            </template>
            <template #createdAt="{ row }">
              {{ formatTime(timeOf(row, 'created_at')) }}
            </template>
          </ConsumeGrid>
        </TabPane>

        <TabPane key="read" tab="阅读记录">
          <Form layout="inline" class="mb-3">
            <FormItem label="剧ID">
              <Input
                v-model:value="filters.read.res_id"
                allow-clear
                class="w-32"
              />
            </FormItem>
            <FormItem label="状态">
              <Select
                v-model:value="filters.read.state"
                allow-clear
                :options="normalStateOptions"
                class="w-36"
              />
            </FormItem>
            <FormItem>
              <Button type="primary" @click="search('read')"> 查询 </Button>
            </FormItem>
          </Form>
          <ReadGrid>
            <template #cover="{ row }">
              <Image v-if="imageSrc(row)" :src="imageSrc(row)" :height="56" />
            </template>
            <template #state="{ row }">
              <Tag :color="stateOf(row) === 1 ? 'green' : 'red'">
                {{ stateOf(row) === 1 ? '正常' : '已删除' }}
              </Tag>
            </template>
            <template #updatedAt="{ row }">
              {{ formatTime(timeOf(row, 'update_at', 'updated_at')) }}
            </template>
          </ReadGrid>
        </TabPane>

        <TabPane key="readDetail" tab="阅读详情记录">
          <Form layout="inline" class="mb-3">
            <FormItem label="剧ID">
              <Input
                v-model:value="filters.readDetail.res_id"
                allow-clear
                class="w-32"
              />
            </FormItem>
            <FormItem label="章节ID">
              <Input
                v-model:value="filters.readDetail.item_id"
                allow-clear
                class="w-32"
              />
            </FormItem>
            <FormItem label="统计日">
              <Input
                v-model:value="filters.readDetail.stat_day"
                allow-clear
                placeholder="20241022"
                class="w-32"
              />
            </FormItem>
            <FormItem label="状态">
              <Select
                v-model:value="filters.readDetail.state"
                allow-clear
                :options="normalStateOptions"
                class="w-36"
              />
            </FormItem>
            <FormItem>
              <Button type="primary" @click="search('readDetail')">
                查询
              </Button>
            </FormItem>
          </Form>
          <ReadDetailGrid>
            <template #cover="{ row }">
              <Image v-if="imageSrc(row)" :src="imageSrc(row)" :height="56" />
            </template>
            <template #state="{ row }">
              <Tag :color="stateOf(row) === 1 ? 'green' : 'red'">
                {{ stateOf(row) === 1 ? '正常' : '已删除' }}
              </Tag>
            </template>
            <template #createdAt="{ row }">
              {{ formatTime(timeOf(row, 'created_at')) }}
            </template>
          </ReadDetailGrid>
        </TabPane>

        <TabPane key="links" tab="链接变化">
          <Form layout="inline" class="mb-3">
            <FormItem label="链接ID">
              <Input
                v-model:value="filters.links.link_id"
                allow-clear
                class="w-32"
              />
            </FormItem>
            <FormItem label="广告ID">
              <Input
                v-model:value="filters.links.ad_id"
                allow-clear
                class="w-40"
              />
            </FormItem>
            <FormItem label="状态">
              <Select
                v-model:value="filters.links.state"
                allow-clear
                :options="normalStateOptions"
                class="w-36"
              />
            </FormItem>
            <FormItem>
              <Button type="primary" @click="search('links')"> 查询 </Button>
            </FormItem>
          </Form>
          <LinkGrid>
            <template #state="{ row }">
              <Tag :color="stateOf(row) === 1 ? 'green' : 'red'">
                {{ stateOf(row) === 1 ? '当前链接' : '历史链接' }}
              </Tag>
            </template>
            <template #createdAt="{ row }">
              {{ formatTime(timeOf(row, 'create_time')) }}
            </template>
            <template #updatedAt="{ row }">
              {{ formatTime(timeOf(row, 'update_time')) }}
            </template>
          </LinkGrid>
        </TabPane>

        <TabPane key="tokens" tab="Firebase Token">
          <TokenGrid>
            <template #current="{ row }">
              <Tag :color="currentOf(row) ? 'green' : 'default'">
                {{ boolText(currentOf(row)) }}
              </Tag>
            </template>
            <template #updatedAt="{ row }">
              {{
                formatTime(
                  timeOf(row, 'updated_at', 'last_seen_at', 'created_at'),
                )
              }}
            </template>
          </TokenGrid>
        </TabPane>

        <TabPane key="overview" tab="推广/阅读概览">
          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <h3 class="mb-2 font-medium">当前推广链接</h3>
              <CurrentLinkGrid v-if="detail.current_links?.length" />
              <Empty v-else description="暂无当前推广链接" />
            </div>
            <div>
              <h3 class="mb-2 font-medium">最近阅读历史</h3>
              <ReadHistoryGrid v-if="detail.read_history?.length" />
              <Empty v-else description="暂无阅读历史" />
            </div>
          </div>
        </TabPane>
      </Tabs>
    </div>
  </Modal>
</template>
