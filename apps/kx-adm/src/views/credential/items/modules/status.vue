<script lang="ts" setup>
import type { CredentialView } from '#/api/credential';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Alert, Input, message } from 'antdv-next';

import { CredentialApi } from '#/api/credential';
import { useAuthStore } from '#/store';

const emit = defineEmits<{ success: [] }>();
const authStore = useAuthStore();
const credential = ref<CredentialView>();
const totpCode = ref('');
const enabling = computed(() => credential.value?.state === 'disabled');
const title = computed(
  () =>
    `${enabling.value ? '启用' : '禁用'}凭证 - ${credential.value?.name ?? ''}`,
);

const [Modal, modalApi] = useVbenModal<CredentialView>({
  async onConfirm() {
    if (!credential.value || !/^\d{6}$/.test(totpCode.value)) return;
    modalApi.lock();
    try {
      const grant = await authStore.authorizeStepUp(
        'credential.status',
        totpCode.value,
      );
      await (enabling.value
        ? CredentialApi.enable(credential.value.code, grant.grant_token)
        : CredentialApi.disable(credential.value.code, grant.grant_token));
      message.success(enabling.value ? '凭证已启用' : '凭证已禁用');
      emit('success');
      modalApi.close();
    } finally {
      totpCode.value = '';
      modalApi.unlock();
    }
  },
  onOpenChange(open) {
    if (!open) {
      credential.value = undefined;
      totpCode.value = '';
      return;
    }
    credential.value = modalApi.getData();
  },
});

function normalizeCode(value: string) {
  totpCode.value = value.replaceAll(/\D/g, '').slice(0, 6);
}
</script>

<template>
  <Modal
    :confirm-disabled="!/^\d{6}$/.test(totpCode)"
    confirm-text="验证并执行"
    :title="title"
  >
    <div class="grid gap-4">
      <Alert
        :message="
          enabling
            ? '启用前会校验当前凭证仍可解密且处于有效期。'
            : '禁用后所有已绑定消费者会立即停止解析该凭证。'
        "
        show-icon
        type="warning"
      />
      <label class="grid gap-1 text-sm">
        <span>动态验证码</span>
        <Input
          :value="totpCode"
          autocomplete="one-time-code"
          inputmode="numeric"
          ::maxlength="6"
          placeholder="输入 6 位 TOTP 获取 credential.status 授权"
          @update:value="normalizeCode"
        />
      </label>
    </div>
  </Modal>
</template>
