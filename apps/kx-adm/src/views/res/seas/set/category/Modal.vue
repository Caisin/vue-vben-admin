<script lang="ts" setup>
import { reactive, ref, watch } from 'vue';

import {
  Form,
  FormItem,
  Input,
  InputNumber,
  message,
  Modal,
  RadioGroup,
} from 'antdv-next';

import { postSave } from '#/api/res/seas/set/category';

const props = withDefaults(
  defineProps<{
    open?: boolean;
    record?: null | Record<string, any>;
  }>(),
  {
    open: false,
    record: null,
  },
);

const emit = defineEmits<{
  saved: [];
  'update:open': [boolean];
}>();

const saving = ref(false);
const form = reactive<Record<string, any>>({
  id: 0,
  name: '',
  sort_no: 10,
  state: 1,
});

function reset(record?: null | Record<string, any>) {
  Object.assign(form, {
    id: 0,
    name: '',
    sort_no: 10,
    state: 1,
    ...record,
  });
}

function close() {
  emit('update:open', false);
}

async function submit() {
  if (!String(form.name ?? '').trim()) {
    message.warning('请输入分类名称');
    return;
  }
  saving.value = true;
  try {
    await postSave({
      ...(form.id ? { id: Number(form.id) } : {}),
      name: String(form.name).trim(),
      sort_no: Number(form.sort_no ?? 10),
      state: Number(form.state ?? 1),
    });
    emit('saved');
    close();
  } finally {
    saving.value = false;
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) reset(props.record);
  },
);
</script>

<template>
  <Modal
    :confirm-loading="saving"
    destroy-on-close
    :open="open"
    :title="form.id ? '编辑分类' : '新增分类'"
    width="560px"
    @cancel="close"
    @ok="submit"
  >
    <Form :model="form" layout="vertical">
      <FormItem label="分类名称" required>
        <Input v-model:value="form.name" placeholder="请输入分类名称" />
      </FormItem>
      <FormItem label="状态">
        <RadioGroup
          v-model:value="form.state"
          option-type="button"
          :options="[
            { label: '正常', value: 1 },
            { label: '禁用', value: 0 },
          ]"
        />
      </FormItem>
      <FormItem label="排序">
        <InputNumber v-model:value="form.sort_no" class="w-full" />
      </FormItem>
    </Form>
  </Modal>
</template>
