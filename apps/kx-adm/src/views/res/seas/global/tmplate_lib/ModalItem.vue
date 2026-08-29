<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { computed, ref, watch } from 'vue';

import { Button, message, Modal, Popconfirm, Space, Tag } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  getTmpDetail,
  postSaveItem,
  postSaveVipItem,
} from '#/api/res/seas/global/tmplate_lib';

import ItemDetail from './ModalItemDetail.vue';
const props = withDefaults(
  defineProps<{
    itemType?: string;
    open: boolean;
    record?: Record<string, any>;
  }>(),
  { itemType: 'normal', record: () => ({}) },
);
const emit = defineEmits<{ success: []; 'update:open': [value: boolean] }>();
const loading = ref(false);
const saving = ref(false);
const items = ref<any[]>([]);
const detailOpen = ref(false);
const activeItem = ref<any>({});
const isVip = computed(() => props.itemType === 'vip');
const title = computed(
  () => `${props.record?.name ?? ''} - ${isVip.value ? 'VIP模板项' : '模板项'}`,
);
const columns = [
  { field: 'title', title: '标题', width: 180 },
  {
    field: 'item_type',
    slots: { default: 'itemType' },
    title: '类型',
    width: 100,
  },
  { field: 'amount', title: '金额', width: 100 },
  { field: 'coin', title: '金币', width: 100 },
  { field: 'coupon', title: '赠币', width: 100 },
  { field: 'vip_days', title: 'VIP天数', width: 100 },
  { field: 'action', slots: { default: 'action' }, title: '操作', width: 140 },
];
const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns,
    height: 360,
    pagerConfig: { enabled: false },
    rowConfig: { keyField: 'id' },
    toolbarConfig: { enabled: false },
  } as VxeTableGridOptions,
});
watch(items, (rows) => void gridApi.grid.reloadData(rows), { deep: true });
watch(
  () => props.open,
  (open) => {
    if (open) load();
  },
);
async function load() {
  if (!props.record?.id) return;
  loading.value = true;
  gridApi.setLoading(true);
  try {
    const detail = await getTmpDetail({ id: props.record.id });
    const all = detail?.items ?? [];
    items.value = all.filter((item: any) =>
      isVip.value ? item.item_type === 'vip' : item.item_type !== 'vip',
    );
  } finally {
    loading.value = false;
    gridApi.setLoading(false);
  }
}
function add() {
  activeItem.value = { item_type: isVip.value ? 'vip' : 'normal' };
  detailOpen.value = true;
}
function edit(record: any) {
  activeItem.value = JSON.parse(JSON.stringify(record));
  detailOpen.value = true;
}
function remove(record: any) {
  items.value = items.value.filter((item) => item !== record);
}
async function saveItem(item: any) {
  const idx = items.value.findIndex((row) => row.id && row.id === item.id);
  if (idx === -1) {
    items.value.push(item);
  } else {
    items.value[idx] = item;
  }
  detailOpen.value = false;
}
async function persist() {
  saving.value = true;
  try {
    const payload = items.value.map((item, index) => ({
      ...item,
      sort: item.sort ?? index + 1,
    }));
    await (isVip.value
      ? postSaveVipItem(props.record?.id, payload)
      : postSaveItem(props.record?.id, payload));
    message.success('保存成功');
    emit('success');
    emit('update:open', false);
  } finally {
    saving.value = false;
  }
}
</script>
<template>
  <Modal
    :open="open"
    :title="title"
    width="980px"
    :confirm-loading="saving"
    @cancel="emit('update:open', false)"
    @ok="persist"
  >
    <Space direction="vertical" class="w-full">
      <Button type="primary" @click="add">
        新增{{ isVip ? 'VIP' : '模板' }}项
      </Button>
      <Grid>
        <template #itemType="{ row }">
          <Tag>{{ row.item_type }}</Tag>
        </template>
        <template #action="{ row }">
          <Space>
            <Button type="link" size="small" @click="edit(row)">编辑</Button>
            <Popconfirm title="确认删除该项？" @confirm="remove(row)">
              <Button danger type="link" size="small">删除</Button>
            </Popconfirm>
          </Space>
        </template>
      </Grid>
    </Space>
    <ItemDetail
      v-model:open="detailOpen"
      :item-type="isVip ? 'vip' : activeItem.item_type"
      :record="activeItem"
      @submit="saveItem"
    />
  </Modal>
</template>
