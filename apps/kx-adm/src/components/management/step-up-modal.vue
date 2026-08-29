<script lang="ts" setup>
import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Input } from 'antdv-next';

import { MfaApi } from '#/api/core';

interface StepUpAction {
  action: string;
  onVerified: (grantToken: string) => Promise<void>;
  title: string;
}

const current = ref<StepUpAction>();
const totpCode = ref('');
const valid = computed(() => /^\d{6}$/.test(totpCode.value));

const [Modal, modalApi] = useVbenModal<StepUpAction>({
  destroyOnClose: false,
  async onConfirm() {
    if (!current.value || !valid.value) return;
    modalApi.lock();
    try {
      const grant = await MfaApi.stepUp({
        action: current.value.action,
        totp_code: totpCode.value,
      });
      await current.value.onVerified(grant.grant_token);
      modalApi.close();
    } finally {
      modalApi.unlock();
    }
  },
  onOpenChange(open) {
    if (open) {
      current.value = modalApi.getData();
      totpCode.value = '';
      return;
    }
    current.value = undefined;
    totpCode.value = '';
  },
});

function onInput(value: string) {
  totpCode.value = value.replaceAll(/\D/g, '').slice(0, 6);
}
</script>

<template>
  <Modal
    :confirm-disabled="!valid"
    confirm-text="验证并执行"
    :title="current?.title || '二次验证'"
  >
    <label class="step-up-field grid gap-1 text-sm">
      <span>动态验证码</span>
      <Input
        :value="totpCode"
        autocomplete="one-time-code"
        inputmode="numeric"
        ::maxlength="6"
        placeholder="请输入 6 位验证码"
        @update:value="onInput"
      />
    </label>
  </Modal>
</template>

<style scoped>
.step-up-field {
  color: hsl(var(--foreground));
}

.step-up-field :deep(.ant-input) {
  letter-spacing: 0.18em;
}
</style>
