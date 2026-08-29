<script lang="ts" setup>
import { computed, ref, watch } from 'vue';

import { Card, Empty, Modal, Space, Spin, Tag } from 'antdv-next';

import { getTmpDetail } from '#/api/res/seas/global/tmplate_lib';
const props = defineProps<{ open: boolean; record?: Record<string, any> }>();
const emit = defineEmits<{ 'update:open': [value: boolean] }>();
const loading = ref(false);
const detail = ref<any>({});
const items = ref<any[]>([]);
const vipItems = computed(() =>
  items.value.filter((item) => item.item_type === 'vip'),
);
const normalItems = computed(() =>
  items.value.filter((item) => item.item_type !== 'vip'),
);
watch(
  () => props.open,
  (open) => {
    if (open) load();
  },
);
async function load() {
  if (!props.record?.id) return;
  loading.value = true;
  try {
    const res = await getTmpDetail({ id: props.record.id });
    detail.value = res?.info ?? props.record;
    items.value = res?.items ?? [];
  } finally {
    loading.value = false;
  }
}
</script>
<template>
  <Modal
    :footer="null"
    :open="open"
    :title="detail.name || record?.name || '模板预览'"
    width="720px"
    @cancel="emit('update:open', false)"
  >
    <Spin :spinning="loading">
      <Space direction="vertical" class="w-full">
        <Card title="VIP 商品" size="small">
          <Space v-if="vipItems.length" wrap>
            <Card
              v-for="item in vipItems"
              :key="item.id || item.title"
              class="w-[200px]"
              size="small"
            >
              <b>{{ item.title }}</b><br />{{ item.amount }} 美分 / VIP {{ item.vip_days || 0 }} 天
            </Card>
          </Space>
          <Empty v-else />
        </Card>
        <Card title="普通/章节商品" size="small">
          <Space v-if="normalItems.length" wrap>
            <Card
              v-for="item in normalItems"
              :key="item.id || item.title"
              class="w-[200px]"
              size="small"
            >
              <b>{{ item.title }}</b><br /><Tag>{{ item.item_type }}</Tag> {{ item.amount }} 美分 /
              {{ item.coin || 0 }} 金币
            </Card>
          </Space>
          <Empty v-else />
        </Card>
      </Space>
    </Spin>
  </Modal>
</template>
