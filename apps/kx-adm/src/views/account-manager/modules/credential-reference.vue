<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';

import { CredentialApi } from '#/api/credential';

const props = defineProps<{ code: string }>();
const label = ref('未选择凭证');
let sequence = 0;
watch(
  () => props.code,
  async (code) => {
    const current = ++sequence;
    if (!code) {
      label.value = '未选择凭证';
      return;
    }
    label.value = '正在加载凭证';
    try {
      const credential = await CredentialApi.detail(code);
      if (current !== sequence) return;
      const status = {
        active: '',
        retired: '（已退役）',
        disabled: '（已停用）',
      }[credential.state];
      label.value = `${credential.name}${status}`;
    } catch {
      if (current === sequence) label.value = '凭证不可用或无权查看';
    }
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  sequence++;
});
</script>

<template>
  <span>{{ label }}</span>
</template>
