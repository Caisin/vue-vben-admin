<script lang="ts" setup>
import type { CredentialRevealView, CredentialView } from '#/api/credential';

import { computed, onBeforeUnmount, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import {
  Alert,
  Button,
  Input,
  message,
  Spin,
  TextArea,
  TypographyText,
} from 'antdv-next';

import { CredentialApi } from '#/api/credential';
import { isStepUpGrantRejected } from '#/request-errors';
import { useAuthStore } from '#/store';
import { Times } from '#/times';

const authStore = useAuthStore();
const credential = ref<CredentialView>();
const revealed = ref<CredentialRevealView>();
const loading = ref(false);
const totpCode = ref('');
const grantExpiresAt = ref<number | string>();
const hasActiveGrant = ref(false);
const confirmText = computed(() => (revealed.value ? '关闭' : '验证并查看'));
const grantExpiresAtText = computed(() =>
  Times.formatOptionalUnix(grantExpiresAt.value),
);

const [Modal, modalApi] = useVbenModal<CredentialView>({
  destroyOnClose: false,
  async onConfirm() {
    if (revealed.value) return modalApi.close();
    await revealCredential();
  },
  onOpenChange(open) {
    if (!open) {
      credential.value = undefined;
      revealed.value = undefined;
      totpCode.value = '';
      grantExpiresAt.value = undefined;
      hasActiveGrant.value = false;
      return;
    }
    credential.value = modalApi.getData();
    const grant = authStore.currentPrivacyRevealGrant();
    grantExpiresAt.value = grant?.expires_at;
    hasActiveGrant.value = Boolean(grant);
    if (grant) {
      void revealCredential().catch(() =>
        message.error('凭证明文加载失败，请重新验证后重试'),
      );
    }
  },
});

function normalizeCode(value: string) {
  return value.replaceAll(/\D/g, '').slice(0, 6);
}

async function copyField(label: string, value: string) {
  await navigator.clipboard.writeText(value);
  message.success(`${label} 已复制`);
}

async function revealCredential() {
  if (!credential.value) return;
  revealed.value = undefined;
  const current = authStore.currentPrivacyRevealGrant();
  const code = normalizeCode(totpCode.value);
  if (!current && !/^\d{6}$/.test(code)) return;
  loading.value = true;
  modalApi.lock();
  try {
    const grant = current ?? (await authStore.authorizePrivacyReveal(code));
    grantExpiresAt.value = grant.expires_at;
    hasActiveGrant.value = true;
    try {
      revealed.value = await CredentialApi.reveal(
        credential.value.code,
        grant.grant_token,
      );
    } catch (error) {
      revealed.value = undefined;
      if (isStepUpGrantRejected(error)) {
        authStore.clearPrivacyRevealGrant();
        grantExpiresAt.value = undefined;
        hasActiveGrant.value = false;
      }
      throw error;
    }
  } finally {
    loading.value = false;
    modalApi.unlock();
  }
}

onBeforeUnmount(() => {
  revealed.value = undefined;
  credential.value = undefined;
  totpCode.value = '';
});
</script>

<template>
  <Modal
    :confirm-disabled="
      !revealed && !hasActiveGrant && !/^\d{6}$/.test(totpCode)
    "
    :confirm-loading="loading"
    :confirm-text="confirmText"
    :title="`查看凭证明文 - ${credential?.name ?? ''}`"
  >
    <Alert
      class="mb-4"
      message="明文只保存在当前弹窗内存中；关闭弹窗或请求失败会立即清空。"
      show-icon
      type="warning"
    />
    <Spin :spinning="loading">
      <div class="grid gap-4">
        <label v-if="!hasActiveGrant" class="grid gap-1 text-sm">
          <span>动态验证码</span>
          <Input
            :value="totpCode"
            autocomplete="one-time-code"
            inputmode="numeric"
            ::maxlength="6"
            placeholder="请输入 6 位验证码"
            @update:value="totpCode = normalizeCode($event)"
            @press-enter="revealCredential"
          />
        </label>
        <Alert
          v-if="revealed"
          show-icon
          type="success"
          :message="`授权有效至 ${grantExpiresAtText}。`"
        />
        <div
          v-for="field in revealed?.fields ?? []"
          :key="field.field"
          class="grid gap-1 text-sm"
        >
          <div class="flex items-center justify-between gap-2">
            <span>{{ field.label }}</span>
            <Button size="small" @click="copyField(field.label, field.value)">
              复制
            </Button>
          </div>
          <TextArea
            v-if="field.multiline"
            :value="field.value"
            :rows="4"
            readonly
          />
          <Input v-else :value="field.value" readonly />
        </div>
        <TypographyText v-if="!revealed && !hasActiveGrant" type="secondary">
          验证通过后才会临时加载当前凭证明文。
        </TypographyText>
      </div>
    </Spin>
  </Modal>
</template>
