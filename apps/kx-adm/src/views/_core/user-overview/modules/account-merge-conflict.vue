<script lang="ts" setup>
import type {
  AccountMerge,
  AccountMergeChallenge,
  AccountMergeKeepAccount,
  AccountMergeProfileSource,
} from '#/api/core/account-binding';

import { computed, nextTick, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import {
  Alert,
  Avatar,
  Button,
  Descriptions,
  DescriptionsItem,
  Divider,
  Input,
  InputPassword,
  Radio,
  RadioGroup,
  Select,
  Space,
  Spin,
  Tag,
} from 'antdv-next';

import { AccountMergeApi, MfaApi } from '#/api';
import { Times } from '#/times';

interface ModalData {
  appKey?: string;
  challengeId: string;
}

const emit = defineEmits<{
  abandon: [];
  submitted: [merge: AccountMerge];
  switchDingtalk: [appKey?: string];
}>();

const preview = ref<AccountMergeChallenge>();
const loading = ref(false);
const stage = ref<'conflict' | 'merge'>('conflict');
const keepAccount = ref<AccountMergeKeepAccount>();
const profileSelection = ref<Record<string, AccountMergeProfileSource>>({});
const password = ref('');
const totpCode = ref('');
const modalData = ref<ModalData>();
const dialogContent = ref<HTMLElement>();

const fields = [
  { key: 'display_name', label: '名称' },
  { key: 'avatar', label: '头像' },
  { key: 'mobile', label: '手机号' },
  { key: 'email', label: '邮箱' },
  { key: 'department', label: '部门' },
  { key: 'home', label: '默认页面' },
] as const;

const reauthMode = computed(() => preview.value?.reauth_modes[0]);
const selectionsComplete = computed(
  () =>
    !!keepAccount.value &&
    fields.every(({ key }) => profileSelection.value[key]),
);
const reauthComplete = computed(() => {
  if (reauthMode.value === 'step_up_grant')
    return /^\d{6}$/.test(totpCode.value);
  if (reauthMode.value === 'password') return password.value.length > 0;
  return false;
});
const canSubmit = computed(
  () => selectionsComplete.value && reauthComplete.value,
);

const [Modal, modalApi] = useVbenModal<ModalData>({
  destroyOnClose: false,
  onOpenChange(open) {
    if (!open) return;
    modalData.value = modalApi.getData();
    reset();
    void loadPreview();
  },
});

function reset() {
  preview.value = undefined;
  loading.value = false;
  stage.value = 'conflict';
  keepAccount.value = undefined;
  profileSelection.value = {};
  password.value = '';
  totpCode.value = '';
}

async function loadPreview() {
  if (!modalData.value?.challengeId) return;
  loading.value = true;
  try {
    preview.value = await AccountMergeApi.challenge(
      modalData.value.challengeId,
    );
  } finally {
    loading.value = false;
  }
}

async function abandon() {
  if (!modalData.value?.challengeId) return;
  loading.value = true;
  try {
    await AccountMergeApi.abandonChallenge(modalData.value.challengeId);
    modalApi.close();
    emit('abandon');
  } finally {
    loading.value = false;
  }
}

function switchAccount() {
  modalApi.close();
  emit('switchDingtalk', preview.value?.app_key ?? modalData.value?.appKey);
}

async function setStage(nextStage: 'conflict' | 'merge') {
  stage.value = nextStage;
  await nextTick();
  dialogContent.value?.scrollIntoView({ block: 'start' });
}

function startMerge() {
  void setStage('merge');
}

function onTotpInput(value: string) {
  totpCode.value = value.replaceAll(/\D/g, '').slice(0, 6);
}

async function submit() {
  if (!preview.value || !keepAccount.value || !canSubmit.value) return;
  loading.value = true;
  try {
    let grantToken: string | undefined;
    if (reauthMode.value === 'step_up_grant') {
      const grant = await MfaApi.stepUp({
        action: 'auth.account.merge',
        totp_code: totpCode.value,
      });
      grantToken = grant.grant_token;
    }
    const merge = await AccountMergeApi.create({
      challenge_id: preview.value.challenge_id,
      grant_token: grantToken,
      keep_account: keepAccount.value,
      password: reauthMode.value === 'password' ? password.value : undefined,
      profile_selection: profileSelection.value,
    });
    modalApi.close();
    emit('submitted', merge);
  } finally {
    loading.value = false;
  }
}

function accountLabel(source: AccountMergeProfileSource) {
  return source === 'current' ? '当前账号' : '钉钉账号';
}
</script>

<template>
  <Modal class="w-full max-w-190" :footer="false" title="账号绑定冲突">
    <div ref="dialogContent" class="merge-dialog">
      <Spin :spinning="loading">
        <Alert
          v-if="!preview && !loading"
          message="冲突信息已失效，请重新发起钉钉绑定"
          show-icon
          type="warning"
        />

        <template v-if="preview">
          <Alert
            v-if="stage === 'conflict'"
            description="该钉钉身份已经属于另一个账号。两个账号仍保持独立，选择合并前不会修改任何数据。"
            message="发现已有账号"
            show-icon
            type="warning"
          />
          <Alert
            v-else
            description="合并完成后，被合并账号不能再独立登录，两个账号的活动会话都会撤销。业务数据按数据源事务迁移，遇到唯一约束冲突会暂停任务。"
            message="请确认不可逆影响"
            show-icon
            type="error"
          />

          <div class="account-grid">
            <section class="account-summary">
              <div class="account-heading">
                <Avatar
                  :src="preview.current_user.avatar_url"
                  :alt="preview.current_user.display_name"
                >
                  {{ preview.current_user.display_name.slice(0, 1) }}
                </Avatar>
                <div>
                  <strong>{{ preview.current_user.display_name }}</strong>
                  <Tag color="processing">当前账号</Tag>
                </div>
              </div>
              <Descriptions :column="1" size="small">
                <DescriptionsItem label="手机号">
                  {{ preview.current_user.mobile_masked || '-' }}
                </DescriptionsItem>
                <DescriptionsItem label="邮箱">
                  {{ preview.current_user.email_masked || '-' }}
                </DescriptionsItem>
                <DescriptionsItem label="创建时间">
                  {{ Times.formatUnix(preview.current_user.created_at) }}
                </DescriptionsItem>
                <DescriptionsItem label="登录方式">
                  {{ preview.current_user.login_types.join('、') || '-' }}
                </DescriptionsItem>
              </Descriptions>
            </section>

            <section class="account-summary">
              <div class="account-heading">
                <Avatar
                  :src="preview.dingtalk_user.avatar_url"
                  :alt="preview.dingtalk_user.display_name"
                >
                  {{ preview.dingtalk_user.display_name.slice(0, 1) }}
                </Avatar>
                <div>
                  <strong>{{ preview.dingtalk_user.display_name }}</strong>
                  <Tag color="cyan">钉钉账号</Tag>
                </div>
              </div>
              <Descriptions :column="1" size="small">
                <DescriptionsItem label="手机号">
                  {{ preview.dingtalk_user.mobile_masked || '-' }}
                </DescriptionsItem>
                <DescriptionsItem label="邮箱">
                  {{ preview.dingtalk_user.email_masked || '-' }}
                </DescriptionsItem>
                <DescriptionsItem label="创建时间">
                  {{ Times.formatUnix(preview.dingtalk_user.created_at) }}
                </DescriptionsItem>
                <DescriptionsItem label="登录方式">
                  {{ preview.dingtalk_user.login_types.join('、') || '-' }}
                </DescriptionsItem>
              </Descriptions>
            </section>
          </div>

          <template v-if="stage === 'conflict'">
            <Divider>业务数据</Divider>
            <div class="domain-list">
              <div
                v-for="domain in preview.domains"
                :key="domain.business_code"
                class="domain-row"
              >
                <span>{{ domain.display_name }}</span>
                <span>
                  当前 {{ domain.target_count }} / 钉钉
                  {{ domain.source_count }}
                </span>
                <Tag :color="domain.blocking ? 'error' : 'success'">
                  {{ domain.blocking ? '需处理' : '可迁移' }}
                </Tag>
              </div>
            </div>
            <div class="dialog-actions">
              <Button @click="abandon">暂不处理</Button>
              <Button @click="switchAccount">切换到钉钉账号</Button>
              <Button type="primary" @click="startMerge">申请合并</Button>
            </div>
          </template>

          <template v-else>
            <Divider>保留账号</Divider>
            <RadioGroup v-model:value="keepAccount">
              <Space direction="vertical">
                <Radio value="current">保留当前账号</Radio>
                <Radio value="dingtalk">保留钉钉账号</Radio>
              </Space>
            </RadioGroup>

            <Divider>资料来源</Divider>
            <div class="field-grid">
              <label v-for="field in fields" :key="field.key">
                <span>{{ field.label }}</span>
                <Select
                  v-model:value="profileSelection[field.key]"
                  :options="
                    (['current', 'dingtalk'] as const).map((source) => ({
                      label: accountLabel(source),
                      value: source,
                    }))
                  "
                  placeholder="请选择资料来源"
                />
              </label>
            </div>

            <Divider>本人确认</Divider>
            <label v-if="reauthMode === 'step_up_grant'" class="reauth-field">
              <span>动态验证码</span>
              <Input
                :value="totpCode"
                autocomplete="one-time-code"
                inputmode="numeric"
                ::maxlength="6"
                placeholder="请输入 6 位验证码"
                @update:value="onTotpInput"
              />
            </label>
            <label v-else-if="reauthMode === 'password'" class="reauth-field">
              <span>当前账号密码</span>
              <InputPassword
                v-model:value="password"
                autocomplete="current-password"
                placeholder="请输入当前账号密码"
              />
            </label>

            <div class="dialog-actions">
              <Button @click="setStage('conflict')">返回</Button>
              <Button
                :disabled="!canSubmit"
                :loading="loading"
                danger
                type="primary"
                @click="submit"
              >
                确认并创建合并任务
              </Button>
            </div>
          </template>
        </template>
      </Spin>
    </div>
  </Modal>
</template>

<style scoped>
.merge-dialog {
  min-height: 280px;
}

.account-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-top: 16px;
}

.account-summary {
  padding: 12px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.account-heading {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 10px;
}

.account-heading > div {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  min-width: 0;
}

.domain-list {
  display: grid;
  gap: 6px;
}

.domain-row {
  display: grid;
  grid-template-columns: minmax(110px, 1fr) minmax(150px, auto) auto;
  gap: 12px;
  align-items: center;
  min-height: 32px;
  font-size: 13px;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.field-grid label,
.reauth-field {
  display: grid;
  gap: 5px;
  font-size: 13px;
}

.dialog-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 20px;
}

@media (max-width: 640px) {
  .account-grid,
  .field-grid {
    grid-template-columns: 1fr;
  }

  .domain-row {
    grid-template-columns: 1fr auto;
  }

  .domain-row > :nth-child(2) {
    grid-row: 2;
    grid-column: 1 / -1;
  }

  .dialog-actions > button {
    flex: 1 1 auto;
  }
}
</style>
