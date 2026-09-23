<script setup lang="ts">
import type {
  ResourceCode,
  ResourceCodeWrite,
} from '#/api/res/seas/global/resource_codes';

import { reactive, watch } from 'vue';

import { Alert, Form, FormItem, Input, Modal } from 'antdv-next';

import { ResourceCodeApi } from '#/api/res/seas/global/resource_codes';
import { requestErrorMessage } from '#/request-errors';

const props = defineProps<{
  initial?: ResourceCode;
}>();
const emit = defineEmits<{ saved: [code: ResourceCode] }>();
const open = defineModel<boolean>('open', { required: true });
const form = reactive<ResourceCodeWrite>({
  code: '',
  name: '',
  author: '',
  remark: '',
});
const errorText = defineModel<string>('errorText', { default: '' });
const busy = defineModel<boolean>('busy', { default: false });

function load() {
  Object.assign(form, {
    code: props.initial?.code ?? '',
    name: props.initial?.name ?? '',
    author: props.initial?.author ?? '',
    remark: props.initial?.remark ?? '',
  });
  errorText.value = '';
}

watch(open, (value) => {
  if (value) load();
});

function confirmOnce(title: string, content: string) {
  return new Promise<boolean>((resolve) => {
    Modal.confirm({
      title,
      content,
      okText: '继续',
      cancelText: '取消',
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
}

async function save() {
  if (busy.value) return;
  if (!form.code.trim() || !form.name.trim()) {
    errorText.value = '请填写作品编号和作品名称';
    return;
  }
  if (props.initial) {
    const first = await confirmOnce(
      '确认修改作品编号信息？',
      '修改作品编号会影响所有关联资源，请确认作品名称、作者和备注。',
    );
    if (!first) return;
    const second = await confirmOnce(
      '再次确认修改',
      `将保存作品编号“${props.initial.code}”的修改，继续后立即生效。`,
    );
    if (!second) return;
  }
  busy.value = true;
  try {
    const saved = props.initial
      ? await ResourceCodeApi.update(props.initial.code, {
          ...form,
          expected_updated_at: props.initial.updated_at,
        })
      : await ResourceCodeApi.create({ ...form });
    open.value = false;
    emit('saved', saved);
  } catch (error) {
    errorText.value = requestErrorMessage(error, '保存作品编号失败');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Modal
    :open="open"
    :title="initial ? '修改作品编号' : '维护作品编号'"
    :confirm-loading="busy"
    :closable="!busy"
    :mask-closable="!busy"
    ok-text="保存"
    @ok="save"
    @cancel="open = false"
  >
    <Alert v-if="errorText" type="error" :message="errorText" class="mb-3" />
    <Form layout="vertical">
      <FormItem label="作品编号" required>
        <Input v-model:value="form.code" :maxlength="255" />
      </FormItem>
      <FormItem label="作品名称" required>
        <Input v-model:value="form.name" :maxlength="255" />
      </FormItem>
      <FormItem label="作者">
        <Input v-model:value="form.author" :maxlength="255" />
      </FormItem>
      <FormItem label="备注">
        <Input.TextArea
          v-model:value="form.remark"
          :rows="4"
          :maxlength="4000"
        />
      </FormItem>
    </Form>
  </Modal>
</template>
