<script lang="ts" setup>
import type { CredentialBindingView, CredentialView } from '#/api/credential';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Alert, Checkbox, Input, message, Table } from 'antdv-next';

import { CredentialApi } from '#/api/credential';
import { useAuthStore } from '#/store';

const emit = defineEmits<{ success: [] }>();
const authStore = useAuthStore();
const credential = ref<CredentialView>();
const totpCode = ref('');
const bindings = ref<CredentialBindingView[]>([]);
const loadingBindings = ref(false);
const impactConfirmed = ref(false);
const title = computed(() => `退役凭证 - ${credential.value?.name ?? ''}`);
const columns = [
  { dataIndex: 'consumer', title: '消费者', width: 100 },
  { dataIndex: 'owner_type', title: '对象类型', width: 120 },
  { dataIndex: 'owner_key', title: '对象键' },
  { dataIndex: 'slot', title: '用途', width: 100 },
];

const [Modal, modalApi] = useVbenModal<CredentialView>({
  async onConfirm() {
    if (
      !credential.value ||
      !impactConfirmed.value ||
      !/^\d{6}$/.test(totpCode.value)
    ) {
      message.warning('请确认绑定影响并输入 6 位 TOTP 验证码');
      return;
    }
    modalApi.lock();
    try {
      const grant = await authStore.authorizeStepUp(
        'credential.retire',
        totpCode.value,
      );
      await CredentialApi.retire(
        credential.value.code,
        {
          confirmed: true,
        },
        grant.grant_token,
      );
      message.success('凭证已退役');
      emit('success');
      modalApi.close();
    } finally {
      modalApi.unlock();
      totpCode.value = '';
    }
  },
  onOpenChange(open) {
    if (!open) {
      credential.value = undefined;
      totpCode.value = '';
      bindings.value = [];
      impactConfirmed.value = false;
      return;
    }
    credential.value = modalApi.getData();
    void loadBindings();
  },
});

async function loadBindings() {
  if (!credential.value) return;
  loadingBindings.value = true;
  try {
    bindings.value = await CredentialApi.bindings(credential.value.code);
  } finally {
    loadingBindings.value = false;
  }
}

function normalizeCode(value: string) {
  return value.replaceAll(/\D/g, '').slice(0, 6);
}
</script>

<template>
  <Modal
    :confirm-disabled="!impactConfirmed || !/^\d{6}$/.test(totpCode)"
    confirm-text="退役"
    :title="title"
  >
    <div class="grid gap-4">
      <Alert
        message="退役后不可恢复，也不会再被业务解析使用；已有绑定仅用于影响展示和审计。"
        show-icon
        type="warning"
      />
      <Table
        :columns="columns"
        :data-source="bindings"
        :loading="loadingBindings"
        row-key="id"
        size="small"
        :pagination="false"
      />
      <Checkbox v-model:checked="impactConfirmed">
        我已确认将影响 {{ bindings.length }} 个绑定位置，并同意永久退役
      </Checkbox>
      <label class="grid gap-1 text-sm">
        <span>动态验证码</span>
        <Input
          :value="totpCode"
          autocomplete="one-time-code"
          inputmode="numeric"
          ::maxlength="6"
          placeholder="输入 6 位 TOTP 获取 credential.retire 授权"
          @update:value="totpCode = normalizeCode($event)"
        />
      </label>
    </div>
  </Modal>
</template>
