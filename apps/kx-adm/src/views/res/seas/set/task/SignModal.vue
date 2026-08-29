<script lang="ts" setup>
import { reactive, ref, watch } from 'vue';

import { Form, FormItem, InputNumber, Modal } from 'antdv-next';

const props = defineProps<{ open: boolean; record?: Record<string, any> }>();
const emit = defineEmits<{
  submit: [value: any];
  'update:open': [value: boolean];
}>();

const saving = ref(false);
const form = reactive<Record<string, number | undefined>>({});

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    for (let day = 1; day <= 7; day++)
      form[`day${day}`] = Number(
        props.record?.[`day${day}`] ?? props.record?.[day] ?? 1,
      );
  },
);

function submit() {
  saving.value = true;
  try {
    emit('submit', { ...form });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Modal
    :open="open"
    title="签到任务奖励"
    width="660px"
    :confirm-loading="saving"
    @cancel="emit('update:open', false)"
    @ok="submit"
  >
    <Form layout="vertical">
      <FormItem v-for="day in 7" :key="day" :label="`周${day}`">
        <InputNumber
          v-model:value="form[`day${day}`]"
          :min="1"
          addon-after="赠币"
          class="w-full"
        />
      </FormItem>
    </Form>
  </Modal>
</template>
