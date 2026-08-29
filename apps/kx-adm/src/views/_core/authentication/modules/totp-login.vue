<script lang="ts" setup>
import { computed, nextTick, ref, watch } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Alert, Input, message } from 'antdv-next';

import { useAuthStore } from '#/store';
import { Times } from '#/times';

const authStore = useAuthStore();
const totpCode = ref('');

const challenge = computed(() => authStore.pendingMfaLogin);
const expiresAt = computed(() =>
  Times.formatOptionalUnix(challenge.value?.expires_at),
);

const [Modal, modalApi] = useVbenModal({
  // 登录表单也可能嵌在会话过期弹窗中，MFA 必须高于父弹窗动态计算出的遮罩层级。
  zIndex: 2100,
  async onConfirm() {
    await submitMfa();
  },
  onOpenChange(isOpen) {
    if (isOpen) {
      totpCode.value = '';
      return;
    }
    totpCode.value = '';
    authStore.clearMfaLogin();
  },
});

async function closeAfterVerified() {
  modalApi.unlock();
  await modalApi.close();
  // Modal 必须在登录页 KeepAlive 失活前将关闭状态刷新到 Portal。
  await nextTick();
}

async function submitMfa() {
  const code = normalizeCode(totpCode.value);
  if (!/^\d{6}$/.test(code)) {
    message.warning('请输入 6 位动态验证码');
    return;
  }
  modalApi.lock();
  try {
    await authStore.completeMfaLogin(code, closeAfterVerified);
  } finally {
    modalApi.unlock();
  }
}

watch(
  challenge,
  (currentChallenge) => {
    if (currentChallenge) modalApi.open();
  },
  { immediate: true },
);

function normalizeCode(value: string) {
  return value.replaceAll(/\D/g, '').slice(0, 6);
}

function onInput(value: string) {
  totpCode.value = normalizeCode(value);
}
</script>

<template>
  <Modal
    class="w-full max-w-120"
    :confirm-loading="authStore.loginLoading"
    title="二次验证"
  >
    <div class="space-y-4">
      <Alert
        show-icon
        type="info"
        :message="`请输入身份验证器中的 6 位动态验证码，challenge 有效期至 ${expiresAt}。`"
      />
      <label class="grid gap-2 text-sm">
        <span>动态验证码</span>
        <Input
          :value="totpCode"
          autocomplete="one-time-code"
          inputmode="numeric"
          ::maxlength="6"
          placeholder="000000"
          size="large"
          @update:value="onInput"
          @press-enter="submitMfa"
        />
      </label>
    </div>
  </Modal>
</template>
