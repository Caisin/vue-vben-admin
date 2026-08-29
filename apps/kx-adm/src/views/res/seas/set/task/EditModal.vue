<script lang="ts" setup>
import { ref, watch } from 'vue';

import { Button, Form, FormItem, InputNumber, Modal, Space } from 'antdv-next';

const props = defineProps<{ list?: any[]; open: boolean }>();
const emit = defineEmits<{
  success: [value: { list: any[] }];
  'update:open': [value: boolean];
}>();

const rows = ref<Array<{ breakpoint: number; reward?: number }>>([]);

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    rows.value = (
      props.list?.length ? props.list : [{ breakpoint: 1, reward: undefined }]
    ).map((item, index) => ({
      breakpoint: Number(item.breakpoint ?? index + 1),
      reward: item.reward,
    }));
  },
);

function add() {
  rows.value.push({ breakpoint: rows.value.length + 1, reward: undefined });
}
function remove(index: number) {
  rows.value.splice(index, 1);
  rows.value.forEach((item, idx) => (item.breakpoint = idx + 1));
}
function submit() {
  emit('success', {
    list: rows.value.map((item, index) => ({
      breakpoint: index + 1,
      reward: Number(item.reward ?? 0),
    })),
  });
  emit('update:open', false);
}
</script>

<template>
  <Modal
    :open="open"
    title="设置分段奖励"
    width="620px"
    @cancel="emit('update:open', false)"
    @ok="submit"
  >
    <Form layout="vertical">
      <Space
        v-for="(item, index) in rows"
        :key="index"
        align="start"
        class="mb-2"
      >
        <FormItem :label="`分段 ${index + 1}`">
          <InputNumber
            v-model:value="item.reward"
            :min="1"
            addon-after="赠币"
          />
        </FormItem>
        <Button
          danger
          class="mt-[30px]"
          :disabled="rows.length <= 1"
          @click="remove(index)"
        >
          删除
        </Button>
      </Space>
      <Button type="dashed" @click="add">新增分段</Button>
    </Form>
  </Modal>
</template>
