<script lang="ts" setup>
import type { AccountBinding } from '#/api/core/account-binding';
import type { AuthUser, DingTalkLoginApp } from '#/api/core/auth';

import { computed, onMounted, reactive, ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Link2, RotateCw, X } from '@vben/icons';

import {
  Avatar,
  Button,
  Descriptions,
  DescriptionsItem,
  Empty,
  Form,
  FormItem,
  Input,
  message,
  Modal,
  Popconfirm,
  Select,
  Skeleton,
  Space,
  Spin,
  Tag,
  Tooltip,
} from 'antdv-next';

import { AccountBindingApi, AuthApi, DingTalkApi } from '#/api';
import { displayValue } from '#/management';
import { Times } from '#/times';

import { parseDingtalkBindingRedirect } from './dingtalk-binding-redirect';
import TotpSecurity from './modules/totp-security.vue';
import WechatBindingModal from './modules/wechat-binding.vue';

defineOptions({ name: 'UserOverview' });

const loading = ref(false);
const loadFailed = ref(false);
const user = ref<AuthUser>();
const bindings = ref<AccountBinding[]>([]);
const bindingLoading = ref(false);
const dingtalkApps = ref<DingTalkLoginApp[]>([]);
const selectedDingtalkAppKey = ref<string>();
const businessOpen = ref(false);
const businessSaving = ref(false);
const businessForm = reactive({
  company: '',
  contact_name: '',
  email: '',
  phone: '',
  title: '',
  website: '',
  wechat: '',
});
const [WechatBinding, wechatBindingApi] = useVbenModal({
  connectedComponent: WechatBindingModal,
});

const contact = computed(() => {
  if (!user.value) return '';
  return user.value.email || user.value.tel || '';
});
const enabledBindingCount = computed(() => bindings.value.length);

const loginTypeLabels: Record<string, string> = {
  ding_talk: '钉钉',
  user_name: '用户名密码',
  wx_mini_app: '微信小程序',
  wx_mini_tel: '微信手机号',
};

function bindingLabel(binding: AccountBinding) {
  return loginTypeLabels[binding.login_type] ?? binding.login_type;
}

function currentRedirectUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete('bind_success');
  url.searchParams.delete('bind_result');
  url.searchParams.delete('bind_challenge_id');
  url.searchParams.delete('merge_challenge_id');
  return url.toString();
}

function confirmDingtalkTransfer(challengeId: string) {
  Modal.confirm({
    cancelText: '取消',
    centered: true,
    content:
      '确认后，该钉钉登录方式将从原账号解绑并绑定到当前账号。原账号的其它登录方式和业务数据不会改变。',
    okText: '确认解绑并绑定',
    title: '该钉钉已绑定其他账号',
    width: 460,
    async onCancel() {
      await AccountBindingApi.cancel_dingtalk_transfer(challengeId);
      message.info('已取消绑定');
    },
    async onOk() {
      await AccountBindingApi.confirm_dingtalk_transfer({
        challenge_id: challengeId,
        confirmed: true,
      });
      message.success('钉钉绑定成功');
      await loadBindings();
    },
  });
}

async function loadBindings() {
  bindingLoading.value = true;
  try {
    bindings.value = await AccountBindingApi.list();
  } finally {
    bindingLoading.value = false;
  }
}

async function loadDingtalkApps() {
  try {
    dingtalkApps.value = await DingTalkApi.apps();
    const defaultApp = dingtalkApps.value.find((app) => app.is_default);
    selectedDingtalkAppKey.value =
      defaultApp?.app_key ?? dingtalkApps.value[0]?.app_key;
  } catch {
    dingtalkApps.value = [];
    selectedDingtalkAppKey.value = undefined;
  }
}

async function startDingtalkBinding() {
  const { authorize_url } = await AccountBindingApi.start_dingtalk({
    app_key: selectedDingtalkAppKey.value,
    redirect_url: currentRedirectUrl(),
  });
  window.location.href = authorize_url;
}

async function removeBinding(binding: AccountBinding) {
  await AccountBindingApi.remove(binding.id);
  message.success('解绑成功');
  await loadBindings();
}

async function loadUser() {
  loading.value = true;
  loadFailed.value = false;
  try {
    const [currentUser] = await Promise.all([
      AuthApi.currentUser(),
      loadBindings(),
      loadDingtalkApps(),
    ]);
    user.value = currentUser;
  } catch {
    loadFailed.value = true;
  } finally {
    loading.value = false;
  }
}

function openBusinessContact() {
  Object.assign(businessForm, user.value?.business_contact);
  businessOpen.value = true;
}

async function saveBusinessContact() {
  businessSaving.value = true;
  try {
    user.value = await AuthApi.updateBusinessContact({ ...businessForm });
    businessOpen.value = false;
    message.success('商务联系卡片已保存');
  } finally {
    businessSaving.value = false;
  }
}

onMounted(async () => {
  const redirect = parseDingtalkBindingRedirect(window.location.href);
  if (redirect.cleanUrl !== window.location.href) {
    window.history.replaceState(
      window.history.state,
      document.title,
      redirect.cleanUrl,
    );
  }
  await loadUser();
  if (redirect.bindResult === 'conflict' && redirect.challengeId) {
    confirmDingtalkTransfer(redirect.challengeId);
  } else if (redirect.bindResult !== null) {
    message[redirect.bindResult === 'success' ? 'success' : 'error'](
      redirect.bindResult === 'success' ? '钉钉绑定成功' : '钉钉绑定失败',
    );
  } else if (redirect.legacySuccess !== null) {
    message[redirect.legacySuccess === 'true' ? 'success' : 'error'](
      redirect.legacySuccess === 'true' ? '钉钉绑定成功' : '钉钉绑定失败',
    );
  }
});
</script>

<template>
  <Page title="我的信息" content-class="user-overview-content">
    <WechatBinding @success="loadBindings" />
    <Modal
      v-model:open="businessOpen"
      title="商务联系卡片"
      width="min(760px, calc(100vw - 32px))"
      :confirm-loading="businessSaving"
      @ok="saveBusinessContact"
    >
      <Form class="business-form" layout="vertical">
        <FormItem label="公司">
          <Input v-model:value="businessForm.company" :maxlength="255" />
        </FormItem>
        <FormItem label="联系人">
          <Input v-model:value="businessForm.contact_name" :maxlength="255" />
        </FormItem>
        <FormItem label="职位">
          <Input v-model:value="businessForm.title" :maxlength="255" />
        </FormItem>
        <FormItem label="联系电话">
          <Input v-model:value="businessForm.phone" :maxlength="255" />
        </FormItem>
        <FormItem label="商务邮箱">
          <Input v-model:value="businessForm.email" :maxlength="255" />
        </FormItem>
        <FormItem label="微信">
          <Input v-model:value="businessForm.wechat" :maxlength="255" />
        </FormItem>
        <FormItem class="business-form-wide" label="网站">
          <Input
            v-model:value="businessForm.website"
            :maxlength="255"
            placeholder="https://"
          />
        </FormItem>
      </Form>
    </Modal>
    <Skeleton v-if="loading && !user" active :paragraph="{ rows: 8 }" />

    <Empty v-else-if="loadFailed && !user" description="用户信息加载失败">
      <Button type="primary" @click="loadUser">
        <RotateCw class="mr-1 size-4" />
        重新加载
      </Button>
    </Empty>

    <template v-else-if="user">
      <header class="profile-header">
        <Avatar :alt="user.name" :size="72" :src="user.avatar">
          {{ user.name.slice(0, 1) }}
        </Avatar>
        <div class="min-w-0 flex-1">
          <div class="profile-name-row">
            <h2>{{ user.name }}</h2>
            <Tag :color="user.enabled ? 'success' : 'default'">
              {{ user.enabled ? '启用' : '停用' }}
            </Tag>
            <Tag v-if="user.is_guest" color="warning">访客</Tag>
          </div>
          <p>{{ contact || '未填写联系方式' }}</p>
        </div>
        <Button :loading="loading" @click="loadUser">
          <RotateCw class="size-4" />
          刷新
        </Button>
      </header>

      <section class="overview-section">
        <h3>账号概览</h3>
        <Descriptions bordered :column="{ xs: 1, sm: 2, lg: 3 }" size="small">
          <DescriptionsItem label="用户 ID">
            {{ user.id }}
          </DescriptionsItem>
          <DescriptionsItem label="部门">
            {{ displayValue(user.dept_name) }}
          </DescriptionsItem>
          <DescriptionsItem label="有效权限">
            <strong>{{ user.permission_count }}</strong> 项
          </DescriptionsItem>
          <DescriptionsItem label="手机号">
            {{ displayValue(user.tel) }}
          </DescriptionsItem>
          <DescriptionsItem label="邮箱">
            {{ displayValue(user.email) }}
          </DescriptionsItem>
          <DescriptionsItem label="默认页面">
            <code>{{ user.home_path }}</code>
          </DescriptionsItem>
          <DescriptionsItem :span="{ xs: 1, sm: 2, lg: 3 }" label="角色">
            <Space v-if="user.roles.length" :size="[4, 4]" wrap>
              <Tag
                v-for="role in user.roles"
                :key="role.role_id"
                :color="role.enabled ? 'processing' : 'default'"
              >
                {{ role.role_name }}（{{ role.role_id }}）
              </Tag>
            </Space>
            <span v-else>-</span>
          </DescriptionsItem>
        </Descriptions>
      </section>

      <section class="overview-section">
        <div class="section-title-row">
          <div>
            <h3>商务联系卡片</h3>
            <p class="section-desc">
              {{ user.business_contact.company || '未配置' }}
            </p>
          </div>
          <Button size="small" @click="openBusinessContact">编辑</Button>
        </div>
        <Descriptions bordered :column="{ xs: 1, sm: 2, lg: 3 }" size="small">
          <DescriptionsItem label="联系人">
            {{ displayValue(user.business_contact.contact_name) }}
          </DescriptionsItem>
          <DescriptionsItem label="职位">
            {{ displayValue(user.business_contact.title) }}
          </DescriptionsItem>
          <DescriptionsItem label="电话">
            {{ displayValue(user.business_contact.phone) }}
          </DescriptionsItem>
          <DescriptionsItem label="邮箱">
            {{ displayValue(user.business_contact.email) }}
          </DescriptionsItem>
          <DescriptionsItem label="微信">
            {{ displayValue(user.business_contact.wechat) }}
          </DescriptionsItem>
          <DescriptionsItem label="网站">
            {{ displayValue(user.business_contact.website) }}
          </DescriptionsItem>
        </Descriptions>
      </section>

      <section class="overview-section">
        <div class="section-title-row">
          <div>
            <h3>登录方式</h3>
            <p class="section-desc">
              已绑定 {{ enabledBindingCount }} 种第三方登录方式
            </p>
          </div>
          <Space wrap class="section-actions">
            <Select
              v-if="dingtalkApps.length > 1"
              v-model:value="selectedDingtalkAppKey"
              :options="
                dingtalkApps.map((app) => ({
                  label: app.app_name,
                  value: app.app_key,
                }))
              "
              class="min-w-40 max-sm:w-full"
              size="small"
            />
            <Button
              :disabled="!dingtalkApps.length"
              :loading="bindingLoading"
              size="small"
              @click="startDingtalkBinding"
            >
              <Link2 class="mr-1 size-4" />
              绑定钉钉
            </Button>
            <Button size="small" @click="wechatBindingApi.open()">
              <Link2 class="mr-1 size-4" />
              绑定微信
            </Button>
          </Space>
        </div>
        <Spin :spinning="bindingLoading">
          <div class="binding-list">
            <div
              v-for="binding in bindings"
              :key="binding.id"
              class="binding-item"
            >
              <div class="min-w-0">
                <div class="binding-title">
                  <Tag color="processing">{{ bindingLabel(binding) }}</Tag>
                  <span>{{ displayValue(binding.app_id) }}</span>
                </div>
                <p>
                  标识：<code>{{ binding.identifier_masked || '-' }}</code> ·
                  绑定时间：{{ Times.formatUnix(binding.created_at) }}
                </p>
              </div>
              <Tooltip v-if="binding.removable" title="解绑登录方式">
                <Popconfirm
                  title="确认解绑该第三方登录方式？"
                  @confirm="removeBinding(binding)"
                >
                  <Button
                    aria-label="解绑登录方式"
                    danger
                    size="small"
                    type="text"
                  >
                    <X class="size-4" />
                  </Button>
                </Popconfirm>
              </Tooltip>
            </div>
            <Empty v-if="!bindings.length" description="暂无第三方绑定" />
          </div>
        </Spin>
      </section>

      <TotpSecurity />

      <section class="overview-section">
        <h3>登录与设备</h3>
        <Descriptions bordered :column="{ xs: 1, sm: 2, lg: 3 }" size="small">
          <DescriptionsItem label="注册 IP">
            <code>{{ displayValue(user.reg_ip) }}</code>
          </DescriptionsItem>
          <DescriptionsItem label="客户端平台">
            {{ displayValue(user.platform) }}
          </DescriptionsItem>
          <DescriptionsItem label="操作系统">
            {{ displayValue(user.os) }}
          </DescriptionsItem>
          <DescriptionsItem label="创建时间">
            {{ Times.formatUnix(user.created_at) }}
          </DescriptionsItem>
          <DescriptionsItem label="更新时间">
            {{ Times.formatUnix(user.updated_at) }}
          </DescriptionsItem>
          <DescriptionsItem label="账号类型">
            {{ user.is_guest ? '访客账号' : '正式账号' }}
          </DescriptionsItem>
        </Descriptions>
      </section>
    </template>
  </Page>
</template>

<style scoped>
:deep(.user-overview-content) {
  max-width: 1200px;
}

.profile-header {
  display: flex;
  gap: 20px;
  align-items: center;
  padding: 8px 0 24px;
  border-bottom: 1px solid hsl(var(--border));
}

.profile-name-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.profile-name-row h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  line-height: 32px;
}

.profile-header p {
  margin: 4px 0 0;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.overview-section {
  margin-top: 24px;
}

.overview-section h3 {
  margin: 0 0 4px;
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
  margin-bottom: 10px;
}

.section-desc {
  margin: 0;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.section-actions {
  justify-content: flex-end;
}

.binding-list {
  display: grid;
  gap: 8px;
}

.business-form {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0 14px;
}

.business-form-wide {
  grid-column: 1 / -1;
}

.binding-item {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.binding-title {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  font-size: 13px;
  font-weight: 500;
}

.binding-item p {
  margin: 4px 0 0;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

code {
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 12px;
  overflow-wrap: anywhere;
}

@media (max-width: 640px) {
  .profile-header {
    gap: 14px;
    align-items: flex-start;
  }

  .profile-header > button {
    width: 100%;
  }

  .section-title-row,
  .section-actions {
    align-items: stretch;
    width: 100%;
  }

  .section-actions :deep(.ant-space-item),
  .section-actions :deep(.ant-btn) {
    width: 100%;
  }

  .binding-item {
    align-items: flex-start;
  }

  .business-form {
    grid-template-columns: 1fr;
  }
}
</style>
