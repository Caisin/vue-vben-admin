<script setup lang="ts">
import { onBeforeUnmount, onDeactivated, ref } from 'vue';

import { Alert, Button, Input, Modal, TextArea } from 'antdv-next';

import { AccountManagerApi } from '#/api/account-manager';
import { isStepUpGrantRejected } from '#/request-errors';
import { useAuthStore } from '#/store';

import { accountError } from '../data';

const auth = useAuthStore();
const open = ref(false);
const busy = ref(false);
const code = ref('');
const secret = ref('');
const errorMessage = ref('');
const target = ref<{ id: number; key: string; label: string }>();
let generation = 0;
function clear() {
  generation++;
  open.value = false;
  secret.value = '';
  code.value = '';
  target.value = undefined;
}
function show(id: number, key: string, label: string) {
  clear();
  target.value = { id, key, label };
  errorMessage.value = '';
  open.value = true;
}
async function reveal() {
  if (!target.value || busy.value) return;
  const current = generation;
  const selected = target.value;
  busy.value = true;
  secret.value = '';
  errorMessage.value = '';
  try {
    const grant =
      auth.currentPrivacyRevealGrant() ??
      (await auth.authorizePrivacyReveal(code.value));
    if (current !== generation) return;
    const value = await AccountManagerApi.reveal(
      selected.id,
      selected.key,
      grant.grant_token,
    );
    if (current === generation && open.value)
      secret.value = String(value.value ?? '');
  } catch (error) {
    if (isStepUpGrantRejected(error)) auth.clearPrivacyRevealGrant();
    if (current === generation) errorMessage.value = accountError(error);
  } finally {
    busy.value = false;
  }
}
onBeforeUnmount(clear);
onDeactivated(clear);
defineExpose({ show });
</script>
<template>
  <Modal
    v-model:open="open"
    :title="`查看${target?.label ?? '敏感字段'}`"
    :footer="null"
    :z-index="3000"
    @cancel="clear"
  >
    <template v-if="open">
      <p class="mb-3">验证后仅在当前弹窗显示，关闭后清空。</p>
      <Input
        v-if="!auth.currentPrivacyRevealGrant() && !secret"
        v-model:value="code"
        aria-label="动态验证码"
        placeholder="请输入 6 位动态验证码"
        autocomplete="one-time-code"
        inputmode="numeric"
        :maxlength="6"
        class="mb-3"
      />
      <TextArea
        v-if="secret.includes('\n')"
        :value="secret"
        aria-label="敏感字段明文"
        :rows="6"
        readonly
      />
      <Input
        v-else-if="secret"
        :value="secret"
        aria-label="敏感字段明文"
        readonly
      />
      <Button
        v-else
        type="primary"
        :loading="busy"
        :disabled="!auth.currentPrivacyRevealGrant() && !/^\d{6}$/.test(code)"
        @click="reveal"
      >
        验证并查看
      </Button>
      <Alert
        v-if="errorMessage"
        class="mt-3"
        :message="errorMessage"
        type="error"
        show-icon
      />
    </template>
  </Modal>
</template>
