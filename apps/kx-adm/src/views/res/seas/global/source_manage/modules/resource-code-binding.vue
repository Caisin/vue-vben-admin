<script setup lang="ts">
import type { ResourceCode } from '#/api/res/seas/global/resource_codes';
import type { ResRecord } from '#/api/res/seas/global/source_manage';

import { ref, watch } from 'vue';

import { Alert, Button, Form, FormItem, Modal, Select } from 'antdv-next';

import { ResourceCodeApi } from '#/api/res/seas/global/resource_codes';
import { requestErrorMessage } from '#/request-errors';

import ResourceCodeManage from './resource-code-manage.vue';
import { useResourceCodeSearch } from './resource-code-search';

const props = defineProps<{ resource?: ResRecord }>();
const emit = defineEmits<{ saved: [resource: ResRecord] }>();
const open = defineModel<boolean>('open', { required: true });
const selected = ref<string>();
const original = ref('');
const saving = ref(false);
const createOpen = ref(false);
const errorText = ref('');
const codes = useResourceCodeSearch(() => selected.value);
function created(code: ResourceCode) {
  codes.addOption(code);
  selected.value = code.code;
  errorText.value = '';
}
watch(
  () => [open.value, props.resource?.id] as const,
  () => {
    if (!open.value) return;
    original.value = props.resource?.resource_code ?? '';
    selected.value = original.value || undefined;
    errorText.value = '';
    void codes.search();
  },
);
async function save() {
  if (saving.value || !props.resource) return;
  if (!selected.value) {
    errorText.value = '请选择作品编号';
    return;
  }
  saving.value = true;
  errorText.value = '';
  try {
    const result = await ResourceCodeApi.associate(props.resource.id, {
      resource_code: selected.value,
      expected_resource_code: original.value,
    });
    open.value = false;
    emit('saved', result);
  } catch (error) {
    errorText.value = requestErrorMessage(error, '关联作品编号失败');
  } finally {
    saving.value = false;
  }
}
</script>
<template>
  <Modal
    v-model:open="open"
    title="关联作品编号"
    ok-text="保存关联"
    :confirm-loading="saving"
    :closable="!saving"
    :mask-closable="!saving"
    :keyboard="!saving"
    :cancel-button-props="{ disabled: saving }"
    @ok="save"
  >
    <Alert v-if="errorText" type="error" :message="errorText" class="mb-3" />
    <Form layout="vertical">
      <FormItem label="资源">
        {{ resource?.res_name }}（{{ resource?.id }}）
      </FormItem>
      <FormItem label="当前作品编号">{{ original || '未关联' }}</FormItem>
      <FormItem label="关联作品编号" required>
        <div class="flex gap-2">
          <Select
            v-model:value="selected"
            v-bind="codes.componentProps()"
            :disabled="saving"
            class="min-w-0 flex-1"
          />
          <Button :disabled="saving" @click="createOpen = true">
            新增作品编号
          </Button>
        </div>
      </FormItem>
    </Form>
  </Modal>
  <ResourceCodeManage
    v-model:open="createOpen"
    :default-name="resource?.res_name"
    @saved="created"
  />
</template>
