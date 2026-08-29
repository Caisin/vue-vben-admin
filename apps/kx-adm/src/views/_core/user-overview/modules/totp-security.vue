<script lang="ts" setup>
import type { MfaStatusView, TotpSetupView } from '#/api';

import { onMounted, ref } from 'vue';

import {
  Alert,
  Button,
  Descriptions,
  DescriptionsItem,
  Divider,
  Input,
  InputPassword,
  message,
  Popconfirm,
  QRCode,
  Space,
  Spin,
  Tag,
  TypographyText,
} from 'antdv-next';

import { MfaApi } from '#/api';
import { Times } from '#/times';

import { buildTotpDisableRequest } from './totp-security';

const status = ref<MfaStatusView>();
const setup = ref<TotpSetupView>();
const loading = ref(false);
const confirmCode = ref('');
const disableCode = ref('');
const disablePassword = ref('');

function normalizeCode(value: string) {
  return value.replaceAll(/\D/g, '').slice(0, 6);
}

function onConfirmCode(value: string) {
  confirmCode.value = normalizeCode(value);
}

function onDisableCode(value: string) {
  disableCode.value = normalizeCode(value);
}

async function loadStatus() {
  loading.value = true;
  try {
    status.value = await MfaApi.status();
  } finally {
    loading.value = false;
  }
}

async function startSetup() {
  loading.value = true;
  try {
    setup.value = await MfaApi.setup();
    confirmCode.value = '';
  } finally {
    loading.value = false;
  }
}

async function confirmSetup() {
  const code = normalizeCode(confirmCode.value);
  if (!/^\d{6}$/.test(code)) {
    message.warning('请输入 6 位动态验证码');
    return;
  }
  loading.value = true;
  try {
    status.value = await MfaApi.confirm({ totp_code: code });
    setup.value = undefined;
    confirmCode.value = '';
    message.success('TOTP 二次验证已启用');
  } finally {
    loading.value = false;
  }
}

async function disableTotp() {
  const code = normalizeCode(disableCode.value);
  if (status.value?.password_required && !disablePassword.value) {
    message.warning('请输入当前登录密码');
    return;
  }
  if (!/^\d{6}$/.test(code)) {
    message.warning('请输入 6 位动态验证码');
    return;
  }
  loading.value = true;
  try {
    status.value = await MfaApi.disable(
      buildTotpDisableRequest(
        status.value?.password_required ?? true,
        disablePassword.value,
        code,
      ),
    );
    disableCode.value = '';
    disablePassword.value = '';
    setup.value = undefined;
    message.success('TOTP 二次验证已关闭');
  } finally {
    loading.value = false;
  }
}

async function copySecret() {
  if (!setup.value?.secret) return;
  await navigator.clipboard.writeText(setup.value.secret);
  message.success('密钥已复制，请仅粘贴到可信身份验证器');
}

onMounted(loadStatus);
</script>

<template>
  <section class="overview-section">
    <div class="section-title-row">
      <h3>二次验证</h3>
      <Space wrap>
        <Tag :color="status?.totp_enabled ? 'success' : 'warning'">
          {{ status?.totp_enabled ? '已启用 TOTP' : '未启用 TOTP' }}
        </Tag>
        <Button size="small" :loading="loading" @click="loadStatus">
          刷新
        </Button>
      </Space>
    </div>

    <Spin :spinning="loading">
      <Descriptions bordered :column="{ xs: 1, sm: 2, lg: 3 }" size="small">
        <DescriptionsItem label="签发方">
          {{ status?.issuer || '-' }}
        </DescriptionsItem>
        <DescriptionsItem label="账号标签">
          {{ status?.account_label || '-' }}
        </DescriptionsItem>
        <DescriptionsItem label="确认时间">
          {{ Times.formatOptionalUnix(status?.confirmed_at) }}
        </DescriptionsItem>
      </Descriptions>

      <div v-if="setup" class="totp-setup-box">
        <Alert
          show-icon
          type="warning"
          message="请立即用身份验证器扫描二维码或手动录入密钥。确认前再次开始配置会替换未确认密钥。"
        />
        <div class="totp-setup-content">
          <QRCode :value="setup.otpauth_uri" :size="180" />
          <div class="totp-secret-panel">
            <TypographyText type="secondary">手动密钥</TypographyText>
            <code>{{ setup.secret }}</code>
            <TypographyText type="secondary">
              配置有效期至 {{ Times.formatOptionalUnix(setup.expires_at) }}
            </TypographyText>
            <Space wrap>
              <Button size="small" @click="copySecret">复制密钥</Button>
              <Input
                :value="confirmCode"
                autocomplete="one-time-code"
                inputmode="numeric"
                ::maxlength="6"
                placeholder="输入 6 位验证码确认启用"
                @update:value="onConfirmCode"
                @press-enter="confirmSetup"
              />
              <Button
                type="primary"
                :disabled="!/^\d{6}$/.test(confirmCode)"
                @click="confirmSetup"
              >
                确认启用
              </Button>
            </Space>
          </div>
        </div>
      </div>

      <div v-else-if="!status?.totp_enabled" class="totp-action-box">
        <Alert
          show-icon
          type="info"
          message="启用 TOTP 后，账号登录和查看存储认证明文等高风险操作都需要二次验证。"
        />
        <Button type="primary" @click="startSetup">开始配置 TOTP</Button>
      </div>

      <div v-else class="totp-action-box">
        <Alert
          show-icon
          type="success"
          :message="
            status.password_required
              ? '当前账号已启用 TOTP。关闭前必须同时输入当前登录密码和动态验证码。'
              : '当前账号未配置本地登录密码，关闭前需验证当前动态验证码。'
          "
        />
        <Space wrap>
          <InputPassword
            v-if="status.password_required"
            v-model:value="disablePassword"
            autocomplete="current-password"
            placeholder="当前登录密码"
          />
          <Input
            :value="disableCode"
            autocomplete="one-time-code"
            inputmode="numeric"
            ::maxlength="6"
            placeholder="6 位验证码"
            @update:value="onDisableCode"
            @press-enter="disableTotp"
          />
          <Popconfirm title="确认关闭 TOTP 二次验证？" @confirm="disableTotp">
            <Button danger>关闭 TOTP</Button>
          </Popconfirm>
        </Space>
      </div>
      <Divider />
      <TypographyText type="secondary">
        查看密码明文等高风险操作会要求输入 TOTP，并使用一次性 step-up
        授权完成操作。
      </TypographyText>
    </Spin>
  </section>
</template>

<style scoped>
.overview-section {
  margin-top: 24px;
}

.overview-section h3 {
  margin: 0 0 10px;
  font-size: 15px;
  font-weight: 600;
  line-height: 24px;
}

.section-title-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.totp-setup-box,
.totp-action-box {
  display: grid;
  gap: 12px;
  margin-top: 12px;
}

.totp-setup-content {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: flex-start;
}

.totp-secret-panel {
  display: grid;
  flex: 1;
  gap: 10px;
  min-width: min(280px, 100%);
}

.totp-secret-panel code {
  padding: 8px;
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 12px;
  overflow-wrap: anywhere;
  background: hsl(var(--muted));
  border-radius: 6px;
}

@media (max-width: 640px) {
  .section-title-row {
    align-items: stretch;
  }

  .section-title-row :deep(.ant-space),
  .totp-action-box :deep(.ant-space),
  .totp-secret-panel :deep(.ant-space) {
    width: 100%;
  }

  .section-title-row :deep(.ant-space-item),
  .totp-action-box :deep(.ant-space-item),
  .totp-secret-panel :deep(.ant-space-item),
  .totp-action-box :deep(.ant-btn),
  .totp-secret-panel :deep(.ant-btn),
  .totp-action-box :deep(.ant-input),
  .totp-secret-panel :deep(.ant-input),
  .totp-action-box :deep(.ant-input-password) {
    width: 100%;
  }
}
</style>
