<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  MeilisearchInstallConfig,
  SoftwareApplication,
  SoftwareInstallation,
  SoftwareServer,
  SoftwareVersion,
} from '#/api/software';

import { computed, onMounted, reactive, ref, watch } from 'vue';

import { Page } from '@vben/common-ui';
import { createIconifyIcon, Plus } from '@vben/icons';

import {
  Alert,
  Button,
  Checkbox,
  Form,
  FormItem,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Space,
  Tag,
} from 'antdv-next';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import { SoftwareApi } from '#/api/software';
import { SystemSettingsApi } from '#/api/system/settings';
import { CredentialSelect } from '#/components/credential';
import { createIdempotencyKey } from '#/management';

import OperationProgress from '../operations/operation-progress.vue';
import { useColumns, useGridFormSchema } from './data';
import DetectSoftware from './detect-software.vue';
import {
  defaultMeilisearchConfig,
  meilisearchConfigFrom,
} from './meilisearch-config';
import MeilisearchConfigForm from './meilisearch-config-form.vue';
import { packageConfigFrom, packageDefaults } from './package-config';
import RuntimeSettings from './runtime-settings.vue';

const servers = ref<SoftwareServer[]>([]);
const operationProgress = ref<InstanceType<typeof OperationProgress>>();
const PlayIcon = createIconifyIcon('lucide:play');
const StopIcon = createIconifyIcon('lucide:square');
const RestartIcon = createIconifyIcon('lucide:rotate-cw');
const SettingsIcon = createIconifyIcon('lucide:settings-2');
const applications = ref<SoftwareApplication[]>([]);
const targetVersions = ref<SoftwareVersion[]>([]);
const creating = ref(false);
const submitting = ref(false);
const initializeSearchKeyLoading = ref(false);
const versionLoading = ref(false);
const createOpen = ref(false);
const editingInstallation = ref<SoftwareInstallation>();
const actionOpen = ref(false);
const stateColors: Record<string, string> = {
  failed: 'error',
  installing: 'processing',
  running: 'success',
};
const actionLabels: Record<string, string> = {
  start: '启动',
  stop: '停止',
  restart: '重启',
  'apply-config': '应用配置并重启',
  check: '检查状态',
  install: '安装',
  reinstall: '重新安装',
  rollback: '回滚',
  switch: '切换版本',
  uninstall: '卸载',
};
const action = ref('switch');
const current = ref<SoftwareInstallation>();
const targetVersion = ref('');
const credentialSelect = ref<{ reload: () => Promise<void> }>();
const createForm = reactive({
  admin_credential_code: '',
  application_id: '',
  config_json: {},
  install_root: '',
  instance_key: 'default',
  server_id: '',
});
const serviceConfig = reactive({ listen: '127.0.0.1', port: 0 });
const installMethod = ref('provider');
const packageConfig = ref(packageDefaults());
const runtimeSettings = ref<Record<string, string>>({});
const serviceArgs = ref<string[]>([]);
const overrideArgs = ref(false);
const supportsPackage = computed(() =>
  ['mysql', 'postgres', 'redis'].includes(
    selectedApplication.value?.provider ?? '',
  ),
);
const currentPackage = computed(
  () => current.value?.config_json.install_method === 'package',
);
const meilisearchConfig = ref<MeilisearchInstallConfig>(
  defaultMeilisearchConfig(),
);
const selectedApplication = computed(() =>
  applications.value.find((item) => item.id === createForm.application_id),
);
const selectedServer = computed(() =>
  servers.value.find((item) => item.id === createForm.server_id),
);
watch(
  selectedApplication,
  (application, previousApplication) => {
    if (
      application?.id !== previousApplication?.id &&
      !editingInstallation.value
    ) {
      createForm.admin_credential_code = '';
      createForm.install_root = application?.install_root ?? '';
      meilisearchConfig.value = defaultMeilisearchConfig();
      installMethod.value = ['mysql', 'postgres', 'redis'].includes(
        application?.provider ?? '',
      )
        ? 'package'
        : 'provider';
      packageConfig.value = packageDefaults();
    }
    if (application?.service_spec?.default_port) {
      serviceConfig.port = application.service_spec.default_port;
    }
  },
  { immediate: true },
);
const needsDatabaseCredential = computed(() =>
  ['mysql', 'postgres'].includes(selectedApplication.value?.provider ?? ''),
);
const needsSearchCredential = computed(
  () => selectedApplication.value?.provider === 'meilisearch',
);
const needsAdminCredential = computed(
  () =>
    installMethod.value !== 'package' &&
    (needsDatabaseCredential.value || needsSearchCredential.value),
);
const serverOptions = () =>
  servers.value.map((item) => ({ label: item.name, value: item.id }));
const applicationOptions = () =>
  applications.value.map((item) => ({ label: item.name, value: item.id }));

const [Grid, gridApi] = useVbenVxeGrid<SoftwareInstallation>({
  formOptions: {
    schema: useGridFormSchema(serverOptions, applicationOptions),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) =>
          SoftwareApi.installations({
            ...formValues,
            page: page.currentPage,
            size: page.pageSize,
          }),
      },
    },
    rowConfig: { keyField: 'id' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<SoftwareInstallation>,
});

async function loadReferenceData() {
  const [serverPage, appPage] = await Promise.all([
    SoftwareApi.servers({ page: 1, size: 200 }),
    SoftwareApi.applications({ page: 1, size: 200 }),
  ]);
  servers.value = serverPage.items;
  applications.value = appPage.items;
}

function openCreate() {
  runtimeSettings.value = {};
  serviceArgs.value = [];
  overrideArgs.value = false;
  editingInstallation.value = undefined;
  Object.assign(createForm, {
    admin_credential_code: '',
    application_id: '',
    config_json: {},
    install_root: '',
    instance_key: 'default',
    server_id: '',
  });
  serviceConfig.listen = '127.0.0.1';
  serviceConfig.port = 0;
  meilisearchConfig.value = defaultMeilisearchConfig();
  createOpen.value = true;
}

function openConfig(row: SoftwareInstallation) {
  runtimeSettings.value = {
    ...(row.config_json.runtime_settings as Record<string, string>),
  };
  overrideArgs.value = Array.isArray(row.config_json.service_args);
  serviceArgs.value = overrideArgs.value
    ? [...(row.config_json.service_args as string[])]
    : [];
  editingInstallation.value = row;
  Object.assign(createForm, {
    admin_credential_code:
      typeof row.config_json.admin_credential_code === 'string'
        ? row.config_json.admin_credential_code
        : '',
    application_id: row.application_id,
    config_json: row.config_json,
    install_root: '',
    instance_key: row.instance_key,
    server_id: row.server_id,
  });
  serviceConfig.listen = String(row.config_json.listen ?? '127.0.0.1');
  serviceConfig.port = Number(row.config_json.port ?? 0);
  meilisearchConfig.value = meilisearchConfigFrom(row.config_json);
  createOpen.value = true;
  installMethod.value =
    row.config_json.install_method === 'package' ? 'package' : 'provider';
  packageConfig.value = packageConfigFrom(row.config_json.package);
}

async function saveInstallation(apply = false) {
  if (needsAdminCredential.value && !createForm.admin_credential_code.trim()) {
    message.warning(
      needsSearchCredential.value
        ? '请选择已配置的 Meilisearch Master Key 凭证'
        : '请选择数据库管理员凭证',
    );
    return;
  }
  creating.value = true;
  try {
    let configJson: Record<string, unknown>;
    if (installMethod.value === 'package')
      configJson = {
        install_method: 'package',
        package: { ...packageConfig.value },
        runtime_settings: { ...runtimeSettings.value },
      };
    else if (needsSearchCredential.value)
      configJson = { ...meilisearchConfig.value };
    else
      configJson = {
        listen: serviceConfig.listen,
        port: serviceConfig.port || undefined,
      };
    if (selectedApplication.value?.provider === 'custom' && overrideArgs.value)
      configJson.service_args = [...serviceArgs.value];
    const saved = await (editingInstallation.value
      ? SoftwareApi.updateInstallationConfig(editingInstallation.value.id, {
          admin_credential_code: needsAdminCredential.value
            ? createForm.admin_credential_code
            : undefined,
          config_json: configJson,
          expected_version: editingInstallation.value.version,
        })
      : SoftwareApi.createInstallation({
          ...createForm,
          admin_credential_code: needsAdminCredential.value
            ? createForm.admin_credential_code
            : undefined,
          config_json: configJson,
        }));
    if (editingInstallation.value)
      editingInstallation.value = { ...editingInstallation.value, ...saved };
    if (apply) {
      const operation = await SoftwareApi.installationAction(
        saved.id,
        'apply-config',
        {
          idempotency_key: createIdempotencyKey(),
          expected_row_version: saved.version,
          confirmed: true,
        },
      );
      operationProgress.value?.open(operation);
    }
    createOpen.value = false;
    message.success(
      editingInstallation.value ? '实例配置已保存' : '安装实例已创建',
    );
    await gridApi.query();
  } finally {
    creating.value = false;
  }
}

async function initializeMeilisearchMasterKey() {
  initializeSearchKeyLoading.value = true;
  try {
    const credential = await SystemSettingsApi.initializeMeilisearchMasterKey();
    if (
      credential.state !== 'active' ||
      !credential.summary.fields.some(
        (field) => field.field === 'password' && field.configured,
      )
    ) {
      message.warning(
        'Meilisearch Master Key 凭证不可用，请在凭证中心启用或重新配置',
      );
      return;
    }
    createForm.admin_credential_code = credential.code;
    await credentialSelect.value?.reload();
    message.success('Meilisearch Master Key 已生成并选中');
  } finally {
    initializeSearchKeyLoading.value = false;
  }
}

async function openAction(row: SoftwareInstallation, value: string) {
  current.value = row;
  action.value = value;
  if (value === 'switch') {
    targetVersion.value = row.available_version ?? '';
  } else if (value === 'rollback') {
    targetVersion.value = row.previous_version;
  } else {
    targetVersion.value = '';
  }
  targetVersions.value = [];
  actionOpen.value = true;
  if (
    ['install', 'rollback', 'switch'].includes(value) &&
    !currentPackage.value
  ) {
    versionLoading.value = true;
    try {
      const response = await SoftwareApi.versions(row.application_id, {
        page: 1,
        size: 200,
      });
      targetVersions.value = response.items.filter(
        (version) => version.state !== 'disabled',
      );
    } finally {
      versionLoading.value = false;
    }
  }
}

async function submitAction() {
  if (!current.value) return;
  if (
    ['install', 'rollback', 'switch'].includes(action.value) &&
    !currentPackage.value &&
    !targetVersion.value
  ) {
    message.warning('请选择目标版本');
    return;
  }
  submitting.value = true;
  try {
    const operation = await SoftwareApi.installationAction(
      current.value.id,
      action.value,
      {
        confirmed: action.value === 'uninstall',
        expected_row_version: current.value.version,
        idempotency_key: createIdempotencyKey(),
        target_version:
          ['install', 'rollback', 'switch'].includes(action.value) &&
          !currentPackage.value
            ? targetVersion.value
            : undefined,
      },
    );
    actionOpen.value = false;
    message.success('操作已提交');
    await gridApi.query();
    operationProgress.value?.open(operation);
  } finally {
    submitting.value = false;
  }
}

function deleteInstallation(row: SoftwareInstallation) {
  Modal.confirm({
    content: `删除后保留操作审计记录，但不能再从安装实例列表恢复 ${row.application_name} / ${row.instance_key}。`,
    okText: '确认删除',
    okType: 'danger',
    title: '删除安装实例',
    async onOk() {
      await SoftwareApi.deleteInstallation(row.id);
      message.success('安装实例已删除');
      await gridApi.query();
    },
  });
}

function stateColor(value: string) {
  return stateColors[value] ?? 'default';
}

onMounted(loadReferenceData);
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
    title="安装实例"
  >
    <OperationProgress ref="operationProgress" @completed="gridApi.query()" />
    <Grid class="management-grid" table-title="安装实例">
      <template #toolbar-tools>
        <Button
          v-access:code="'software:installation:create'"
          type="primary"
          @click="openCreate"
        >
          <Plus class="size-5" />
          新建实例
        </Button>
      </template>
      <template #instance="{ row }">
        <div class="font-medium">
          {{ row.application_name }} / {{ row.instance_key }}
        </div>
        <div class="text-xs text-muted-foreground">
          {{ row.server_name }} ({{ row.server_code }})
        </div>
        <Tag v-if="row.config_pending && row.observed_version" color="warning">
          配置待应用
        </Tag>
      </template>
      <template #versions="{ row }">
        <div>当前：{{ row.observed_version || '未安装' }}</div>
        <div class="text-xs text-muted-foreground">
          期望：{{ row.desired_version || '-' }}
        </div>
        <div v-if="row.available_version" class="text-xs text-green-600">
          可更新：{{ row.available_version }}
        </div>
      </template>
      <template #state="{ row }">
        <Tag :color="stateColor(row.state)">{{ row.state }}</Tag>
      </template>
      <template #health="{ row }">
        <Tag
          :color="
            row.health === 'healthy'
              ? 'success'
              : row.health === 'unhealthy'
                ? 'error'
                : 'default'
          "
        >
          {{ row.health }}
        </Tag>
      </template>
      <template #operation="{ row }">
        <Space size="small">
          <Button
            v-if="row.observed_version"
            v-access:code="'software:installation:lifecycle'"
            :aria-label="row.state === 'stopped' ? '启动' : '停止'"
            :title="row.state === 'stopped' ? '启动' : '停止'"
            type="text"
            :disabled="Boolean(row.active_operation_id)"
            @click="openAction(row, row.state === 'stopped' ? 'start' : 'stop')"
          >
            <component
              :is="row.state === 'stopped' ? PlayIcon : StopIcon"
              class="size-4"
            />
          </Button>
          <Button
            v-if="row.observed_version"
            v-access:code="'software:installation:lifecycle'"
            aria-label="重启"
            title="重启"
            type="text"
            :disabled="Boolean(row.active_operation_id)"
            @click="openAction(row, 'restart')"
          >
            <RestartIcon class="size-4" />
          </Button>
          <Button
            v-access:code="'software:installation:create'"
            aria-label="修改配置"
            title="修改配置"
            type="text"
            :disabled="Boolean(row.active_operation_id)"
            @click="openConfig(row)"
          >
            <SettingsIcon class="size-4" />
          </Button>
          <VbenTableAction
            :actions="[
              {
                auth: [
                  row.observed_version &&
                  row.config_json.install_method !== 'package'
                    ? 'software:installation:switch'
                    : 'software:installation:install',
                ],
                icon: row.observed_version
                  ? 'lucide:arrow-left-right'
                  : 'lucide:download',
                onClick: () =>
                  openAction(
                    row,
                    row.observed_version &&
                      row.config_json.install_method !== 'package'
                      ? 'switch'
                      : 'install',
                  ),
                tooltip:
                  row.config_json.install_method === 'package'
                    ? '安装 / 启动原生服务'
                    : row.observed_version
                      ? '切换版本'
                      : '安装',
                disabled: Boolean(row.active_operation_id),
              },
            ]"
            :dropdown-actions="[
              {
                auth: ['software:installation:lifecycle'],
                icon: 'lucide:play',
                text: '启动',
                onClick: () => openAction(row, 'start'),
                disabled: Boolean(row.active_operation_id),
                ifShow:
                  Boolean(row.observed_version) && row.state !== 'running',
              },
              {
                auth: ['software:installation:lifecycle'],
                icon: 'lucide:square',
                text: '停止',
                onClick: () => openAction(row, 'stop'),
                disabled: Boolean(row.active_operation_id),
                ifShow:
                  Boolean(row.observed_version) && row.state !== 'stopped',
              },
              {
                auth: ['software:installation:lifecycle'],
                icon: 'lucide:rotate-cw',
                text: '重启',
                onClick: () => openAction(row, 'restart'),
                disabled: Boolean(row.active_operation_id),
                ifShow: Boolean(row.observed_version),
              },
              {
                auth: ['software:installation:config-apply'],
                icon: 'lucide:settings-2',
                text: '应用配置并重启',
                onClick: () => openAction(row, 'apply-config'),
                disabled: Boolean(row.active_operation_id),
                ifShow: Boolean(row.observed_version),
              },
              {
                auth: ['software:installation:create'],
                icon: 'lucide:settings-2',
                onClick: () => openConfig(row),
                text: '安装配置',
                disabled: Boolean(row.active_operation_id),
              },
              {
                auth: ['software:installation:reinstall'],
                icon: 'lucide:refresh-ccw',
                onClick: () => openAction(row, 'reinstall'),
                text: '重装',
                disabled:
                  Boolean(row.active_operation_id) || !row.initial_version,
                ifShow:
                  Boolean(row.observed_version) &&
                  row.config_json.install_method !== 'package',
              },
              {
                auth: ['software:installation:rollback'],
                icon: 'lucide:undo-2',
                onClick: () => openAction(row, 'rollback'),
                text: '回滚',
                disabled: Boolean(row.active_operation_id),
                ifShow:
                  Boolean(row.observed_version) &&
                  row.config_json.install_method !== 'package',
              },
              {
                auth: ['software:installation:check'],
                icon: 'lucide:scan-search',
                onClick: () => openAction(row, 'check'),
                text: '检查',
                disabled: Boolean(row.active_operation_id),
                ifShow: Boolean(row.observed_version),
              },
              {
                auth: ['software:installation:uninstall'],
                danger: true,
                icon: 'lucide:trash-2',
                onClick: () => openAction(row, 'uninstall'),
                text:
                  row.config_json.install_method === 'package'
                    ? '停止服务（保留数据）'
                    : '卸载',
                disabled: Boolean(row.active_operation_id),
                ifShow: Boolean(row.observed_version),
              },
              {
                auth: ['software:installation:delete'],
                danger: true,
                icon: 'lucide:trash-2',
                onClick: () => deleteInstallation(row),
                text: '删除实例',
                ifShow: ['removed', 'unknown'].includes(row.state),
              },
            ]"
            align="center"
          />
        </Space>
      </template>
    </Grid>

    <Modal
      v-model:open="createOpen"
      :confirm-loading="creating"
      :title="editingInstallation ? '编辑安装配置' : '新建安装实例'"
      :width="820"
      centered
      :styles="{
        body: { maxHeight: 'calc(100dvh - 190px)', overflowY: 'auto' },
      }"
      @ok="saveInstallation()"
    >
      <Form layout="vertical">
        <div class="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <FormItem label="服务器" required>
            <Select
              v-model:value="createForm.server_id"
              :disabled="Boolean(editingInstallation)"
              :options="
                servers.map((item) => ({
                  label: `${item.name} (${item.code})`,
                  value: item.id,
                }))
              "
            />
          </FormItem>
          <FormItem label="应用" required>
            <Select
              v-model:value="createForm.application_id"
              :disabled="Boolean(editingInstallation)"
              :options="
                applications.map((item) => ({
                  label: `${item.name} (${item.code})`,
                  value: item.id,
                }))
              "
            />
          </FormItem>
        </div>
        <FormItem v-if="supportsPackage" label="安装方式">
          <Select
            v-model:value="installMethod"
            :disabled="Boolean(editingInstallation)"
            :options="[
              { label: '系统包管理器', value: 'package' },
              { label: '自定义目录（源码构建）', value: 'provider' },
            ]"
          />
        </FormItem>
        <FormItem label="设备已有安装" v-if="selectedApplication">
          <DetectSoftware
            :server-id="createForm.server_id"
            :provider="selectedApplication.provider"
          />
        </FormItem>
        <template v-if="installMethod === 'package'">
          <RuntimeSettings
            v-if="editingInstallation"
            v-model="runtimeSettings"
            :provider="selectedApplication?.provider ?? ''"
          />
          <div class="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <FormItem label="包管理器">
              <Select
                v-model:value="packageConfig.manager"
                :disabled="Boolean(editingInstallation)"
                :options="
                  ['auto', 'apt', 'dnf', 'yum', 'brew'].map((value) => ({
                    value,
                    label: value === 'auto' ? '自动检测' : value,
                  }))
                "
              />
            </FormItem>
            <FormItem label="包名 / Homebrew Formula">
              <Input
                v-model:value="packageConfig.name"
                :disabled="Boolean(editingInstallation)"
                placeholder="留空使用软件默认包"
              />
            </FormItem>
            <FormItem label="精确包版本">
              <Input
                v-model:value="packageConfig.version"
                :disabled="Boolean(editingInstallation)"
                placeholder="留空使用仓库版本"
              />
            </FormItem>
            <FormItem label="原生服务名称">
              <Input
                v-model:value="packageConfig.service"
                :disabled="Boolean(editingInstallation)"
                placeholder="留空使用软件默认服务"
              />
            </FormItem>
          </div>
          <FormItem>
            <Checkbox v-model:checked="packageConfig.adopt_existing">
              允许接管设备上已有的软件包与服务
            </Checkbox>
          </FormItem>
        </template>
        <Alert
          v-if="selectedServer && (!selectedServer.os || !selectedServer.arch)"
          class="mb-4"
          message="该服务器尚未完成平台探测，安装前会自动探测；建议先在服务器页执行连接测试。"
          show-icon
          type="warning"
        />
        <template
          v-if="
            selectedApplication?.application_kind === 'service' &&
            installMethod !== 'package' &&
            !needsSearchCredential
          "
        >
          <div class="grid grid-cols-[1fr_140px] gap-3">
            <FormItem label="监听地址" required>
              <Input v-model:value="serviceConfig.listen" />
            </FormItem>
            <FormItem label="端口">
              <InputNumber
                v-model:value="serviceConfig.port"
                class="w-full"
                :max="65535"
                :min="0"
              />
            </FormItem>
          </div>
        </template>
        <MeilisearchConfigForm
          v-if="needsSearchCredential"
          v-model="meilisearchConfig"
        />
        <FormItem
          v-if="needsAdminCredential"
          :label="
            needsSearchCredential
              ? 'Meilisearch Master Key'
              : '数据库管理员凭证'
          "
          required
        >
          <Space v-if="needsSearchCredential" class="w-full" wrap>
            <CredentialSelect
              ref="credentialSelect"
              v-model="createForm.admin_credential_code"
              class="min-w-60 flex-1"
              create-kind="password"
              kind="password"
              profile="generic"
              placeholder="选择或生成 Meilisearch Master Key"
            />
            <Button
              :loading="initializeSearchKeyLoading"
              @click="initializeMeilisearchMasterKey"
            >
              <template #icon><Plus /></template>
              生成密钥
            </Button>
          </Space>
          <CredentialSelect
            v-else
            v-model="createForm.admin_credential_code"
            create-kind="username_password"
            kind="username_password"
            profile="generic"
            placeholder="选择数据库管理员凭证"
          />
        </FormItem>
        <FormItem label="实例编码" required>
          <Input
            v-model:value="createForm.instance_key"
            :disabled="Boolean(editingInstallation)"
          />
        </FormItem>
        <FormItem
          v-if="selectedApplication?.provider === 'custom'"
          label="实例启动参数"
        >
          <Checkbox v-model:checked="overrideArgs">覆盖版本启动参数</Checkbox>
          <Select
            v-if="overrideArgs"
            v-model:value="serviceArgs"
            mode="tags"
            class="mt-2 w-full"
          />
        </FormItem>
        <FormItem
          v-if="installMethod !== 'package'"
          :extra="
            editingInstallation
              ? '实例创建后安装目录不可修改。'
              : `最终目录会附加应用和实例子目录：${createForm.install_root || selectedApplication?.install_root || '-'}${selectedApplication ? `/${selectedApplication.code}/${createForm.instance_key || 'default'}` : ''}`
          "
          label="安装目录"
          required
        >
          <Input
            v-if="!editingInstallation"
            v-model:value="createForm.install_root"
            placeholder="请选择应用后自动带出默认目录"
          />
          <Input v-else :value="editingInstallation.install_path" disabled />
        </FormItem>
      </Form>
      <template #footer>
        <Button @click="createOpen = false">取消</Button>
        <Button :loading="creating" @click="saveInstallation()">
          {{ editingInstallation ? '保存配置' : '创建实例' }}
        </Button>
        <Button
          v-if="editingInstallation?.observed_version"
          v-access:code="'software:installation:config-apply'"
          type="primary"
          :loading="creating"
          @click="saveInstallation(true)"
        >
          保存并应用
        </Button>
      </template>
    </Modal>

    <Modal
      v-model:open="actionOpen"
      :confirm-loading="submitting"
      :ok-button-props="{
        danger: ['reinstall', 'rollback', 'uninstall'].includes(action),
      }"
      :ok-text="`确认${actionLabels[action] ?? action}`"
      :title="actionLabels[action] ?? action"
      centered
      @ok="submitAction"
    >
      <Form layout="vertical">
        <FormItem
          v-if="
            ['install', 'rollback', 'switch'].includes(action) &&
            !currentPackage
          "
          label="目标版本"
          required
        >
          <Select
            v-model:value="targetVersion"
            :loading="versionLoading"
            :options="
              targetVersions.map((item) => ({
                label: item.display_version,
                value: item.display_version,
              }))
            "
          />
        </FormItem>
        <Alert
          v-else-if="action === 'reinstall'"
          show-icon
          type="warning"
          :message="`将重新安装首次选择的版本 ${current?.initial_version ?? '-'}`"
        />
        <Alert
          v-else-if="action === 'uninstall'"
          show-icon
          type="warning"
          :message="
            currentPackage
              ? '停止原生服务，保留软件包、配置和数据。'
              : `即将${actionLabels[action]} ${current?.application_name ?? ''} / ${current?.instance_key ?? ''}`
          "
        />
        <div v-else class="py-3">
          {{ current?.application_name }} / {{ current?.instance_key }}
        </div>
      </Form>
    </Modal>
  </Page>
</template>
