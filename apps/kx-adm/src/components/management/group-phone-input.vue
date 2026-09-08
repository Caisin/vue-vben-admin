<script setup lang="ts">
import type { PhoneGroupPhonesAddResult } from '#/api/msg/phone-group';

import { computed, ref, watch } from 'vue';

import { useAccess } from '@vben/access';

import { Alert, Button, Table, TextArea } from 'antdv-next';

import { PhoneGroupApi } from '#/api/msg';
import { requestErrorMessage } from '#/request-errors';

const props = defineProps<{ groupId?: number }>();
const emit = defineEmits<{ added: []; busy: [value: boolean] }>();
const { hasAccessByCodes } = useAccess();
const text = ref('');
const busy = ref(false);
const errorMessage = ref('');
const result = ref<PhoneGroupPhonesAddResult>();
const lines = computed(() =>
  text.value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean),
);
const allowed = computed(() => hasAccessByCodes(['phone_groups:manage']));
watch(
  () => props.groupId,
  () => {
    result.value = undefined;
    errorMessage.value = '';
  },
);
async function submit() {
  if (
    !allowed.value ||
    !props.groupId ||
    busy.value ||
    lines.value.length === 0 ||
    lines.value.length > 500
  )
    return;
  busy.value = true;
  emit('busy', true);
  errorMessage.value = '';
  result.value = undefined;
  try {
    result.value = await PhoneGroupApi.addSimsByPhones(
      props.groupId,
      lines.value,
    );
    text.value = result.value.failed
      .map((item) => item.phone_number)
      .join('\n');
    emit('added');
  } catch (error) {
    errorMessage.value = requestErrorMessage(error, '添加失败，请稍后重试');
  } finally {
    busy.value = false;
    emit('busy', false);
  }
}
</script>
<template>
  <div v-if="allowed" class="flex flex-col gap-3">
    <label>
      <span class="mb-2 block">每行一个号码</span>
      <TextArea
        v-model:value="text"
        aria-label="每行一个号码"
        :rows="8"
        :disabled="busy"
        :maxlength="32000"
        placeholder="13800138000&#10;13800138001&#10;+85261234567"
      />
    </label>
    <p>
      已输入 {{ lines.length }} 行，最多 500
      行；自动去重，只追加号码，保留分组原有成员。
    </p>
    <Alert
      v-if="lines.length > 500"
      type="warning"
      message="超过 500 行，请分批添加。"
      show-icon
    />
    <Alert v-if="errorMessage" type="error" :message="errorMessage" show-icon />
    <Button
      type="primary"
      :loading="busy"
      :disabled="!groupId || lines.length === 0 || lines.length > 500"
      @click="submit"
    >
      添加到分组
    </Button>
    <template v-if="result">
      <Alert
        :type="result.failed.length ? 'warning' : 'success'"
        :message="`新增 ${result.inserted} 个，已存在 ${result.existing} 个，重复输入 ${result.duplicates} 行，未添加 ${result.failed.length} 个`"
        show-icon
      />
      <Table
        v-if="result.failed.length"
        :data-source="result.failed"
        :columns="[
          { dataIndex: 'phone_number', title: '号码' },
          { dataIndex: 'reason', title: '未添加原因' },
        ]"
        :pagination="{ pageSize: 10 }"
        size="small"
      />
    </template>
  </div>
</template>
