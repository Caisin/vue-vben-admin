<script lang="ts" setup>
import type {
  DingtalkCustomRobotCfg,
  DingtalkCustomRobotSecretView,
} from '#/api';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Alert, Input, Spin, TextArea, TypographyText } from 'antdv-next';

import { DingtalkNotifyApi } from '#/api/param/dingtalk-notify';
import { isStepUpGrantRejected } from '#/request-errors';
import { useAuthStore } from '#/store';
import { Times } from '#/times';

const authStore = useAuthStore();
const robot = ref<DingtalkCustomRobotCfg>();
const revealed = ref<DingtalkCustomRobotSecretView>();
const loading = ref(false);
const totpCode = ref('');
const grantExpiresAt = ref<number | string>();
const hasActiveGrant = ref(false);

const confirmText = computed(() => (revealed.value ? '关闭' : '验证并查看'));
const grantExpiresAtText = computed(() =>
  Times.formatOptionalUnix(grantExpiresAt.value),
);

const [Modal, modalApi] = useVbenModal({
  destroyOnClose: false,
  async onConfirm() {
    if (revealed.value) {
      modalApi.close();
      return;
    }
    await revealRobot();
  },
  onOpenChange(isOpen) {
    if (!isOpen) {
      robot.value = undefined;
      revealed.value = undefined;
      totpCode.value = '';
      grantExpiresAt.value = undefined;
      hasActiveGrant.value = false;
      return;
    }
    robot.value = modalApi.getData() as DingtalkCustomRobotCfg;
    revealed.value = undefined;
    totpCode.value = '';
    const grant = authStore.currentPrivacyRevealGrant();
    grantExpiresAt.value = grant?.expires_at;
    hasActiveGrant.value = Boolean(grant);
    if (grant) void revealRobot().catch(() => {});
  },
});

function normalizeCode(value: string) {
  return value.replaceAll(/\D/g, '').slice(0, 6);
}

function onInput(value: string) {
  totpCode.value = normalizeCode(value);
}

async function revealRobot() {
  if (!robot.value) return;
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
      revealed.value = await DingtalkNotifyApi.reveal_custom_robot(
        robot.value.id,
        grant.grant_token,
      );
    } catch (error) {
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
</script>

<template>
  <Modal
    :confirm-disabled="
      !revealed && !hasActiveGrant && !/^\d{6}$/.test(totpCode)
    "
    :confirm-loading="loading"
    :confirm-text="confirmText"
    :title="`机器人隐私配置 - ${robot?.robot_name ?? ''}`"
  >
    <Alert
      class="mb-4"
      message="查看明文前必须完成 TOTP 二次验证；验证后 10 分钟内无需再次输入，超过有效期必须重新验证。"
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
            :maxlength="6"
            placeholder="请输入 6 位验证码"
            @update:value="onInput"
            @press-enter="revealRobot"
          />
        </label>
        <Alert
          v-if="revealed"
          show-icon
          type="success"
          :message="`已通过二次验证，${grantExpiresAtText} 前可继续查看隐私信息；关闭弹窗后当前明文会被清空。`"
        />
        <label class="grid gap-1 text-sm">
          <span>Webhook URL</span>
          <TextArea :value="revealed?.webhook_url" :rows="3" readonly />
        </label>
        <label class="grid gap-1 text-sm">
          <span>加签密钥</span>
          <Input :value="revealed?.secret" readonly />
        </label>
        <TypographyText v-if="!revealed && !hasActiveGrant" type="secondary">
          输入验证码并点击“验证并查看”后才会临时加载明文。
        </TypographyText>
      </div>
    </Spin>
  </Modal>
</template>
