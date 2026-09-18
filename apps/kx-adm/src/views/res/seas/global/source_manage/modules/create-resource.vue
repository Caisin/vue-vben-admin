<script setup lang="ts">
import type { Id, ResourceCreate } from '#/api/res/versions';

import { reactive, ref, watch } from 'vue';

import { Alert, Form, FormItem, Input, Modal, Select } from 'antdv-next';

import { ResourceVersionApi } from '#/api/res/versions';
import { requestErrorMessage } from '#/request-errors';
const emit = defineEmits<{
  saved: [resource: { id: Id; res_name: string; res_type: string }];
}>();
const open = defineModel<boolean>('open', { required: true });
const form = reactive<ResourceCreate>({
  name: '',
  res_type: 'drama',
  intro: '',
  version_name: '初版',
  remark: '',
});
const busy = ref(false);
const errorText = ref('');
watch(open, (value) => {
  if (value) {
    Object.assign(form, {
      name: '',
      res_type: 'drama',
      intro: '',
      version_name: '初版',
      remark: '',
    });
    errorText.value = '';
  }
});
async function save() {
  if (busy.value) return;
  if (!form.name.trim() || !form.version_name.trim()) {
    errorText.value = '请填写资源名称和首个版本名称';
    return;
  }
  busy.value = true;
  try {
    const result = await ResourceVersionApi.createResource({ ...form });
    open.value = false;
    emit('saved', {
      id: result.res_id,
      res_name: form.name,
      res_type: form.res_type,
    });
  } catch (error) {
    errorText.value = requestErrorMessage(error, '创建资源失败');
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <Modal
    :open="open"
    title="新增资源"
    :width="600"
    :confirm-loading="busy"
    :closable="!busy"
    :mask-closable="!busy"
    ok-text="创建并管理版本"
    @ok="save"
    @cancel="open = false"
  >
    <Alert v-if="errorText" type="error" :message="errorText" class="mb-3" />
    <Form layout="vertical">
      <FormItem label="资源类型">
        <Select
          v-model:value="form.res_type"
          :options="[
            { label: '短剧', value: 'drama' },
            { label: '小说', value: 'novel' },
            { label: '剧本', value: 'script' },
          ]"
        />
      </FormItem>
      <FormItem label="资源名称" required>
        <Input
          v-model:value="form.name"
          placeholder="资源名称"
          :maxlength="200"
        />
      </FormItem>
      <FormItem label="简介">
        <Input.TextArea
          v-model:value="form.intro"
          :rows="3"
          :maxlength="1000"
        />
      </FormItem>
      <FormItem label="首个版本名称" required>
        <Input
          v-model:value="form.version_name"
          placeholder="首个版本名称"
          :maxlength="100"
        />
      </FormItem>
      <FormItem label="版本差异备注">
        <Input.TextArea
          v-model:value="form.remark"
          :rows="3"
          :maxlength="4000"
          placeholder="例如：原始版、配音调整、删减说明或改稿说明"
        />
      </FormItem>
    </Form>
  </Modal>
</template>
