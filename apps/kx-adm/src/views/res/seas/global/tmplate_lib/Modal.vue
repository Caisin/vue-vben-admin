<script lang="ts" setup>
import { reactive, ref, watch } from 'vue';

import { Form, FormItem, Input, Modal, Switch } from 'antdv-next';
const props = defineProps<{ open: boolean; record?: Record<string, any> }>();
const emit = defineEmits<{
  submit: [value: any];
  'update:open': [value: boolean];
}>();
const saving = ref(false);
const form = reactive<Record<string, any>>({});
watch(
  () => props.open,
  (open) => {
    if (!open) return;
    Object.keys(form).forEach((key) => Reflect.deleteProperty(form, key));
    Object.assign(
      form,
      JSON.parse(JSON.stringify(props.record ?? { enabled: true })),
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
    title="支付模板"
    width="620px"
    :confirm-loading="saving"
    @cancel="emit('update:open', false)"
    @ok="submit"
  >
    <Form layout="vertical">
      <FormItem label="模板名称" required>
        <Input v-model:value="form.name" />
      </FormItem>
      <FormItem label="状态">
        <Switch
          v-model:checked="form.enabled"
          checked-children="启用"
          un-checked-children="停用"
        />
      </FormItem>
      <FormItem label="备注"><Input v-model:value="form.remark" /></FormItem>
    </Form>
  </Modal>
</template>
