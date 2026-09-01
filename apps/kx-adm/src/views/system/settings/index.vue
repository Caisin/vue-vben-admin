<script lang="ts" setup>
import type { Page as ApiPage } from '#/api/request';
import type { MfaKeyStatusView, SystemSettings } from '#/api/system/settings';

import { onMounted, reactive, ref, watch } from 'vue';

import { Page } from '@vben/common-ui';
import { Plus, RotateCw, Settings } from '@vben/icons';

import {
  Alert,
  Button,
  Descriptions,
  DescriptionsItem,
  Form,
  FormItem,
  Input,
  message,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Tag,
  TextArea,
} from 'antdv-next';

import { requestClient } from '#/api/request';
import { SystemSettingsApi } from '#/api/system/settings';
import { CredentialSelect } from '#/components/credential';
import { FileRefPreview, FileUrlInput } from '#/components/file-picker';
import { applyPublicSystemSettings } from '#/system-settings-init';
import { Times } from '#/times';

const loading = ref(false);
const mfaKeyLoading = ref(false);
const saving = ref(false);
const searchOptionsLoading = ref(false);
const initializeSearchKeyLoading = ref(false);
const meilisearchInstallations = ref<ManagedMeilisearchInstallation[]>([]);

interface ManagedMeilisearchInstallation {
  application_id: number | string;
  application_name: string;
  id: number | string;
  instance_key: string;
  observed_version: string;
  server_access_kind: 'local' | 'ssh';
  server_id: number | string;
  server_name: string;
}

interface SoftwareApplicationRef {
  id: number | string;
}

const form = reactive<SystemSettings>({
  copyright_text: '',
  display_name: '',
  login_banner_url: '',
  login_description: '',
  login_logo_url: '',
  login_title: '',
  system_name: '',
  meilisearch_credential_code: '',
  meilisearch_installation_id: null,
  meilisearch_source: 'custom',
  meilisearch_url: '',
});

const mfaKeyStatus = ref<MfaKeyStatusView>({
  configured: false,
  generated_at: null,
  key_fingerprint: null,
  updated_at: null,
});

function assignSettings(value: SystemSettings) {
  Object.assign(form, value);
}

async function loadSettings() {
  loading.value = true;
  try {
    assignSettings(await SystemSettingsApi.get());
  } finally {
    loading.value = false;
  }
}

async function loadManagedMeilisearch() {
  if (searchOptionsLoading.value || meilisearchInstallations.value.length > 0) {
    return;
  }
  searchOptionsLoading.value = true;
  try {
    const applications = await requestClient.get<
      ApiPage<SoftwareApplicationRef>
    >('/software/applications', {
      params: { page: 1, provider: 'meilisearch', size: 20 },
    });
    const pages = await Promise.all(
      applications.items.map((application) =>
        requestClient.get<ApiPage<ManagedMeilisearchInstallation>>(
          '/software/installations',
          {
            params: {
              application_id: application.id,
              page: 1,
              size: 200,
              state: 'running',
            },
          },
        ),
      ),
    );
    meilisearchInstallations.value = pages
      .flatMap((page) => page.items)
      .filter((item) => item.server_access_kind === 'local');
  } finally {
    searchOptionsLoading.value = false;
  }
}

async function loadMfaKeyStatus() {
  mfaKeyLoading.value = true;
  try {
    mfaKeyStatus.value = await SystemSettingsApi.mfaKeyStatus();
  } finally {
    mfaKeyLoading.value = false;
  }
}

async function ensureMfaKey() {
  mfaKeyLoading.value = true;
  try {
    mfaKeyStatus.value = await SystemSettingsApi.ensureMfaKey();
    message.success('MFA 主密钥已生成并保存');
  } finally {
    mfaKeyLoading.value = false;
  }
}

async function loadPage() {
  await Promise.all([loadSettings(), loadMfaKeyStatus()]);
  if (form.meilisearch_source === 'installation') {
    await loadManagedMeilisearch();
  }
}

async function initializeMeilisearchMasterKey() {
  initializeSearchKeyLoading.value = true;
  try {
    const credential = await SystemSettingsApi.initializeMeilisearchMasterKey();
    form.meilisearch_credential_code = credential.code;
    message.success('Meilisearch Master Key 已初始化，请保存系统设置');
  } finally {
    initializeSearchKeyLoading.value = false;
  }
}

async function saveSettings() {
  if (!form.display_name.trim() || !form.system_name.trim()) {
    message.warning('请填写展示名字和系统名字');
    return;
  }
  saving.value = true;
  try {
    const searchConfigured =
      form.meilisearch_source === 'installation' ||
      Boolean(form.meilisearch_url.trim()) ||
      Boolean(form.meilisearch_credential_code);
    if (searchConfigured && !form.meilisearch_credential_code) {
      message.warning('请选择 Meilisearch 凭证');
      return;
    }
    if (
      form.meilisearch_source === 'installation' &&
      !form.meilisearch_installation_id
    ) {
      message.warning('请选择已安装的 Meilisearch 实例');
      return;
    }
    if (
      searchConfigured &&
      form.meilisearch_source === 'custom' &&
      !form.meilisearch_url.trim()
    ) {
      message.warning('请填写 Meilisearch 服务地址');
      return;
    }
    const saved = await SystemSettingsApi.save(form);
    assignSettings(saved);
    await applyPublicSystemSettings(saved, true);
    message.success('系统设置已保存');
  } finally {
    saving.value = false;
  }
}

watch(
  () => form.meilisearch_source,
  (source) => {
    if (source === 'installation') {
      void loadManagedMeilisearch();
    } else {
      form.meilisearch_installation_id = null;
    }
  },
);

onMounted(loadPage);
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
    title="系统设置"
  >
    <section class="settings-panel">
      <header class="panel-heading">
        <div>
          <h1>系统展示设置</h1>
          <p>配置登录页图标、大图、展示名字、系统名字和版权信息</p>
        </div>
        <Space wrap>
          <Button :loading="loading" @click="loadSettings">
            <template #icon><RotateCw /></template>刷新
          </Button>
          <Button type="primary" :loading="saving" @click="saveSettings">
            <template #icon><Settings /></template>保存
          </Button>
        </Space>
      </header>

      <Form layout="vertical">
        <div class="form-grid">
          <FormItem label="展示名字" required>
            <Input
              v-model:value="form.display_name"
              ::maxlength="80"
              placeholder="显示在登录页 Logo 旁"
            />
          </FormItem>
          <FormItem label="系统名字" required>
            <Input
              v-model:value="form.system_name"
              ::maxlength="80"
              placeholder="浏览器标题和系统名称"
            />
          </FormItem>
          <FormItem label="登录页标题">
            <Input
              v-model:value="form.login_title"
              ::maxlength="120"
              placeholder="登录页大图下方标题"
            />
          </FormItem>
          <FormItem label="登录页描述">
            <Input
              v-model:value="form.login_description"
              ::maxlength="200"
              placeholder="登录页标题下方描述"
            />
          </FormItem>
        </div>

        <FormItem label="版权信息">
          <Input
            v-model:value="form.copyright_text"
            ::maxlength="200"
            placeholder="Copyright © 2026 ..."
          />
        </FormItem>

        <section class="search-settings">
          <header class="panel-heading compact-heading">
            <div>
              <h2>全文搜索</h2>
              <p>选择受管实例或自定义服务，密钥内容由凭证中心统一保管。</p>
            </div>
          </header>
          <FormItem label="服务来源" required>
            <Segmented
              v-model:value="form.meilisearch_source"
              :options="[
                { label: '已安装实例', value: 'installation' },
                { label: '自定义服务', value: 'custom' },
              ]"
            />
          </FormItem>
          <div class="form-grid">
            <FormItem
              v-if="form.meilisearch_source === 'installation'"
              label="Meilisearch 实例"
              required
            >
              <Select
                v-model:value="form.meilisearch_installation_id"
                :loading="searchOptionsLoading"
                :options="
                  meilisearchInstallations.map((item) => ({
                    label: `${item.application_name} / ${item.instance_key} · ${item.server_name} · ${item.observed_version}`,
                    value: item.id,
                  }))
                "
                option-filter-prop="label"
                placeholder="选择本地运行中的 Meilisearch"
                show-search
              />
            </FormItem>
            <FormItem v-else label="服务地址" required>
              <Input
                v-model:value="form.meilisearch_url"
                ::maxlength="512"
                placeholder="http://127.0.0.1:7700"
              />
            </FormItem>
            <FormItem label="凭证" required>
              <Space class="w-full" wrap>
                <CredentialSelect
                  v-model="form.meilisearch_credential_code"
                  class="min-w-60 flex-1"
                  create-kind="password"
                  kind="password"
                  profile="generic"
                  placeholder="选择 password 类型凭证"
                />
                <Button
                  :loading="initializeSearchKeyLoading"
                  @click="initializeMeilisearchMasterKey"
                >
                  <template #icon><Plus /></template>
                  初始化密钥
                </Button>
              </Space>
            </FormItem>
          </div>
        </section>

        <div class="image-grid">
          <FormItem label="登录页图标">
            <div class="image-editor">
              <div class="image-preview logo-preview">
                <FileRefPreview
                  v-if="form.login_logo_url"
                  :value="form.login_logo_url"
                />
                <span v-else>未配置</span>
              </div>
              <FileUrlInput
                v-model="form.login_logo_url"
                accept=".svg,.png,.jpg,.jpeg,image/svg+xml,image/png,image/jpeg,image/*"
                button-text="选择图标"
                placeholder="可直接粘贴公开图片 URL，或从文件库选择/上传（保存文件 ID）"
              />
            </div>
          </FormItem>

          <FormItem label="登录页大图">
            <div class="image-editor">
              <div class="image-preview banner-preview">
                <FileRefPreview
                  v-if="form.login_banner_url"
                  :value="form.login_banner_url"
                />
                <span v-else>未配置</span>
              </div>
              <FileUrlInput
                v-model="form.login_banner_url"
                accept=".svg,.png,.jpg,.jpeg,image/svg+xml,image/png,image/jpeg,image/*"
                button-text="选择大图"
                placeholder="可直接粘贴公开图片 URL，或从文件库选择/上传（保存文件 ID）"
              />
            </div>
          </FormItem>
        </div>

        <FormItem label="说明">
          <TextArea
            disabled
            :rows="3"
            value="公开接口 /param/system-settings/public 会给登录页读取展示配置；storage 私有图片保存文件 ID，展示时用授权换临时 URL，公开图片才直接填写 URL。"
          />
        </FormItem>
      </Form>
    </section>

    <section class="settings-panel">
      <header class="panel-heading">
        <div>
          <h1>二次验证密钥</h1>
          <p>为 TOTP 二次验证和查看明文凭据等 step-up 场景提供系统级加密密钥</p>
        </div>
        <Space wrap>
          <Button :loading="mfaKeyLoading" @click="loadMfaKeyStatus">
            <template #icon><RotateCw /></template>刷新
          </Button>
          <Popconfirm
            ok-text="生成并保存"
            title="系统只会在缺失时生成 MFA 主密钥；已存在时不会轮换，避免已启用 TOTP 的用户失效。"
            @confirm="ensureMfaKey"
          >
            <Button type="primary" :loading="mfaKeyLoading">
              <template #icon><Settings /></template>自动生成并保存
            </Button>
          </Popconfirm>
        </Space>
      </header>

      <Alert
        banner
        class="security-alert"
        message="MFA 主密钥保存为凭证中心 JSON 机密 secret.auth.mfa，只展示状态和指纹，不提供明文查看。"
        type="warning"
      />

      <Descriptions bordered :column="{ xs: 1, md: 2 }" size="small">
        <DescriptionsItem label="配置状态">
          <Tag :color="mfaKeyStatus.configured ? 'success' : 'warning'">
            {{ mfaKeyStatus.configured ? '已配置' : '未配置' }}
          </Tag>
        </DescriptionsItem>
        <DescriptionsItem label="密钥指纹">
          {{ mfaKeyStatus.key_fingerprint || '-' }}
        </DescriptionsItem>
        <DescriptionsItem label="生成时间">
          {{ Times.formatOptionalUnix(mfaKeyStatus.generated_at) }}
        </DescriptionsItem>
        <DescriptionsItem label="更新时间">
          {{ Times.formatOptionalUnix(mfaKeyStatus.updated_at) }}
        </DescriptionsItem>
      </Descriptions>
    </section>
  </Page>
</template>

<style scoped>
.settings-panel {
  min-width: 0;
  padding: 14px 16px;
  margin-bottom: 16px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.panel-heading {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.panel-heading h1 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.panel-heading p {
  margin: 4px 0 0;
  color: hsl(var(--muted-foreground));
}

.form-grid,
.image-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 16px;
}

.image-editor {
  display: grid;
  gap: 10px;
}

.image-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 50%);
  border: 1px dashed hsl(var(--border));
  border-radius: 8px;
}

.logo-preview {
  min-height: 96px;
}

.logo-preview :deep(img) {
  max-width: 120px;
  max-height: 72px;
  object-fit: contain;
}

.banner-preview :deep(img) {
  max-width: 100%;
  max-height: 180px;
  object-fit: contain;
}

.security-alert {
  margin-bottom: 12px;
}

.search-settings {
  padding-top: 20px;
  margin: 24px 0;
  border-top: 1px solid hsl(var(--border));
}

.compact-heading {
  margin-bottom: 14px;
}

.panel-heading h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

@media (max-width: 900px) {
  .form-grid,
  .image-grid {
    grid-template-columns: 1fr;
  }

  .panel-heading {
    flex-direction: column;
    align-items: stretch;
  }

  .panel-heading :deep(.ant-space) {
    justify-content: flex-start;
  }
}
</style>
