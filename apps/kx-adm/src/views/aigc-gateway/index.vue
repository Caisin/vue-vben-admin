<script setup lang="ts">
import type {
  GatewayApiKey,
  GatewayBreaker,
  GatewayMediaJob,
  GatewayOverview,
  GatewayRequest,
  ModelRoute,
  Provider,
  ProviderGroup,
} from '#/api/aigc-gateway';

import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  watch,
} from 'vue';

import { Page } from '@vben/common-ui';
import { useSortable } from '@vben/hooks';
import { GripVertical, IconifyIcon } from '@vben/icons';

import {
  Button,
  Card,
  Form,
  FormItem,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  TabPane,
  Tabs,
  Tag,
  TextArea,
} from 'antdv-next';

import { AigcGatewayApi } from '#/api/aigc-gateway';
import { CredentialSelect } from '#/components/credential';

import Playground from './playground.vue';

const loading = ref(false);
const active = ref('playground');
const breakers = ref<GatewayBreaker[]>([]);
const groups = ref<ProviderGroup[]>([]);
const keys = ref<GatewayApiKey[]>([]);
const mediaJobs = ref<GatewayMediaJob[]>([]);
const models = ref<ModelRoute[]>([]);
const providers = ref<Provider[]>([]);
const requests = ref<GatewayRequest[]>([]);
const selectedGroupId = ref<number | string>();
const providerTableRef = ref();
const groupTableRef = ref();
let providerSortable: null | { destroy: () => void } = null;
let groupSortable: null | { destroy: () => void } = null;
const overview = ref<GatewayOverview>({
  providers: 0,
  active_keys: 0,
  requests: 0,
  total_tokens: 0,
  total_cost: '0',
  open_breakers: 0,
});
const modal = ref<'group' | 'key' | 'model' | 'provider'>();
const editingId = ref<number | string>();
const issuedKey = ref('');
const groupForm = reactive({
  code: '',
  name: '',
  priority: 0,
  load_strategy: 'priority',
  enabled: true,
});
const providerForm = reactive({
  group_id: undefined as number | string | undefined,
  code: '',
  name: '',
  protocol: 'openai',
  base_url: '',
  credential_code: '',
  priority: 0,
  weight: 1,
  enabled: true,
  fail_threshold: 3,
  open_duration_secs: 30,
  breaker_statuses: [401, 403, 429] as number[],
});
const modelForm = reactive({
  provider_id: undefined as number | string | undefined,
  canonical_model: '',
  upstream_model: '',
  aliases: [] as string[],
  capabilities: ['chat'] as string[],
  input_price: '0',
  output_price: '0',
  enabled: true,
});
const keyForm = reactive({
  name: '',
  owner_uid: 0,
  allowed_models: [] as string[],
  expires_at: 0,
});
const groupOptions = computed(() =>
  groups.value.map((v) => ({ label: v.name, value: v.id })),
);
const providerOptions = computed(() =>
  providers.value.map((v) => ({ label: `${v.name} (${v.code})`, value: v.id })),
);
const visibleProviders = computed(() =>
  selectedGroupId.value === undefined
    ? []
    : providers.value.filter((item) => item.group_id === selectedGroupId.value),
);
const modelOptions = computed(() =>
  [...new Set(models.value.map((v) => v.canonical_model))].map((v) => ({
    label: v,
    value: v,
  })),
);
const editingProviderProtocol = computed(
  () =>
    providers.value.find((item) => item.id === modelForm.provider_id)
      ?.protocol ?? 'openai',
);
const editingProviderIsJimeng = computed(() =>
  isJimengProtocol(editingProviderProtocol.value),
);
const editingProviderCapabilitiesLocked = computed(() =>
  ['anthropic', 'deepseek', 'gemini', 'ollama'].includes(
    editingProviderProtocol.value,
  ),
);
const strategyOptions = [
  { label: '优先级', value: 'priority' },
  { label: '轮询', value: 'round_robin' },
  { label: '加权随机', value: 'weighted_random' },
];
const breakerStatusOptions = [401, 403, 408, 409, 429, 500, 502, 503, 504].map(
  (value) => ({ label: `${value}`, value }),
);
const protocolOptions = [
  { label: 'OpenAI', value: 'openai' },
  { label: 'OpenAI Compatible', value: 'openai_compatible' },
  { label: 'DeepSeek', value: 'deepseek' },
  { label: 'Anthropic', value: 'anthropic' },
  { label: 'Google Gemini', value: 'gemini' },
  { label: 'Ollama', value: 'ollama' },
  { label: '火山引擎 · 即梦', value: 'volc_jimeng' },
  { label: 'BytePlus · Jimeng', value: 'byteplus_jimeng' },
];
const protocolDefaultUrls: Record<string, string> = {
  anthropic: 'https://api.anthropic.com/v1',
  byteplus_jimeng: 'https://visual.byteplusapi.com',
  deepseek: 'https://api.deepseek.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
  ollama: 'http://127.0.0.1:11434/v1',
  openai: 'https://api.openai.com/v1',
  openai_compatible: '',
  volc_jimeng: 'https://visual.volcengineapi.com',
};
const jimengModelOptions = [
  { label: '即梦 2.0 · 文生视频', value: 'jimeng_vgfm_t2v_l20' },
  { label: '即梦 2.0 · 图生视频', value: 'jimeng_vgfm_i2v_l20' },
  { label: '即梦 2.5 · 文生视频', value: 'jimeng_vgfm_t2v_l25' },
  { label: '即梦 2.5 · 图生视频', value: 'jimeng_vgfm_i2v_l25' },
];
const capabilityOptions = [
  { label: '对话', value: 'chat' },
  { label: '生图', value: 'image' },
  { label: '生视频', value: 'video' },
];
async function load() {
  loading.value = true;
  try {
    const [o, g, p, m, k, r, b, j] = await Promise.all([
      AigcGatewayApi.overview(),
      AigcGatewayApi.groups(),
      AigcGatewayApi.providers(),
      AigcGatewayApi.models(),
      AigcGatewayApi.keys(),
      AigcGatewayApi.requests({ page: 1, size: 100 }),
      AigcGatewayApi.breakers(),
      AigcGatewayApi.mediaJobs(),
    ]);
    overview.value = o;
    groups.value = g;
    providers.value = p;
    models.value = m;
    keys.value = k;
    requests.value = r.items;
    breakers.value = b;
    mediaJobs.value = j;
    if (
      selectedGroupId.value === undefined ||
      !g.some((item) => item.id === selectedGroupId.value)
    ) {
      selectedGroupId.value = g[0]?.id;
    }
    await initSortables();
  } finally {
    loading.value = false;
  }
}
function openGroup(v?: ProviderGroup) {
  editingId.value = v?.id;
  Object.assign(
    groupForm,
    v ?? {
      code: '',
      name: '',
      priority: 0,
      load_strategy: 'priority',
      enabled: true,
    },
  );
  modal.value = 'group';
}
function openProvider(v?: Provider) {
  editingId.value = v?.id;
  Object.assign(
    providerForm,
    v
      ? { ...v, breaker_statuses: [...v.breaker_statuses] }
      : {
          group_id: selectedGroupId.value ?? groups.value[0]?.id,
          code: '',
          name: '',
          protocol: 'openai',
          base_url: protocolDefaultUrls.openai,
          credential_code: '',
          priority: 0,
          weight: 1,
          enabled: true,
          fail_threshold: 3,
          open_duration_secs: 30,
          breaker_statuses: [401, 403, 429],
        },
  );
  modal.value = 'provider';
}
function selectProviderProtocol(value: string) {
  providerForm.protocol = value;
  providerForm.credential_code = '';
  providerForm.base_url = protocolDefaultUrls[value] ?? '';
}
function openModel(v?: ModelRoute) {
  editingId.value = v?.id;
  const defaultProvider = providers.value[0];
  const defaultCapabilities = isJimengProtocol(defaultProvider?.protocol)
    ? ['video']
    : ['chat'];
  Object.assign(
    modelForm,
    v
      ? {
          ...v,
          aliases: [...v.aliases],
          capabilities: [...(v.capabilities ?? ['chat'])],
        }
      : {
          provider_id: defaultProvider?.id,
          canonical_model: '',
          upstream_model: '',
          aliases: [],
          capabilities: defaultCapabilities,
          input_price: '0',
          output_price: '0',
          enabled: true,
        },
  );
  modal.value = 'model';
}
function openKey() {
  editingId.value = undefined;
  Object.assign(keyForm, {
    name: '',
    owner_uid: 0,
    allowed_models: [],
    expires_at: 0,
  });
  issuedKey.value = '';
  modal.value = 'key';
}
function providerName(id: number | string) {
  return providers.value.find((item) => item.id === id)?.name ?? `#${id}`;
}
function selectModelProvider(id: number | string) {
  modelForm.provider_id = id;
  const protocol = providers.value.find((item) => item.id === id)?.protocol;
  if (isJimengProtocol(protocol)) {
    modelForm.capabilities = ['video'];
  } else if (
    ['anthropic', 'deepseek', 'gemini', 'ollama'].includes(protocol ?? '')
  ) {
    modelForm.capabilities = ['chat'];
  }
}
function selectJimengModel(value: string) {
  modelForm.upstream_model = value;
  if (!modelForm.canonical_model.trim()) modelForm.canonical_model = value;
  modelForm.capabilities = ['video'];
}
function protocolLabel(value: string) {
  return protocolOptions.find((item) => item.value === value)?.label ?? value;
}
function isJimengProtocol(value?: string) {
  return value === 'volc_jimeng' || value === 'byteplus_jimeng';
}
function isHttpProviderProtocol(value: string) {
  return !isJimengProtocol(value);
}
function defaultCredentialKind(value: string) {
  if (value === 'anthropic' || value === 'gemini') return 'http_header';
  return isHttpProviderProtocol(value) ? 'http_token' : 'access_key';
}
async function save() {
  if (modal.value === 'group')
    await AigcGatewayApi.saveGroup({ ...groupForm }, editingId.value);
  if (modal.value === 'provider') {
    if (providerForm.group_id === undefined) {
      message.warning('请选择 Provider 分组');
      return;
    }
    await AigcGatewayApi.saveProvider(
      {
        ...providerForm,
        group_id: providerForm.group_id,
        breaker_statuses: providerForm.breaker_statuses,
      },
      editingId.value,
    );
  }
  if (modal.value === 'model') {
    if (modelForm.provider_id === undefined) {
      message.warning('请选择 Provider');
      return;
    }
    await AigcGatewayApi.saveModel(
      {
        ...modelForm,
        provider_id: modelForm.provider_id,
        aliases: modelForm.aliases,
        capabilities: modelForm.capabilities,
      },
      editingId.value,
    );
  }
  if (modal.value === 'key') {
    const v = await AigcGatewayApi.issueKey(keyForm);
    issuedKey.value = v.api_key;
    message.success('API Key 已签发，仅本次显示');
    await load();
    return;
  }
  modal.value = undefined;
  message.success('已保存');
  await load();
}
async function disableKey(v: GatewayApiKey) {
  Modal.confirm({
    async onOk() {
      await AigcGatewayApi.disableKey(v.id);
      await load();
    },
    okText: '停用',
    okType: 'danger',
    title: `停用 API Key「${v.name}」？`,
  });
}
async function resetBreaker(v: GatewayBreaker) {
  Modal.confirm({
    async onOk() {
      await AigcGatewayApi.resetBreaker(v.id);
      await load();
    },
    okText: '恢复',
    title: `恢复 ${v.provider_code} / ${v.canonical_model}？`,
  });
}
onMounted(load);
onUnmounted(() => {
  providerSortable?.destroy();
  groupSortable?.destroy();
});
watch([active, selectedGroupId], () => void initSortables());

async function initSortables() {
  await nextTick();
  providerSortable?.destroy();
  groupSortable?.destroy();
  providerSortable = null;
  groupSortable = null;
  if (active.value === 'providers') {
    const body = providerTableRef.value?.$el?.querySelector(
      'tbody',
    ) as HTMLElement | null;
    if (body && selectedGroupId.value !== undefined) {
      const { initializeSortable } = useSortable(body, {
        handle: '.aigc-drag-handle',
        async onEnd(event) {
          if (event.oldIndex === undefined || event.newIndex === undefined)
            return;
          const rows = [...visibleProviders.value];
          const [moved] = rows.splice(event.oldIndex, 1);
          if (!moved) return;
          rows.splice(event.newIndex, 0, moved);
          await AigcGatewayApi.reorderProviders(
            selectedGroupId.value as number | string,
            rows.map((item) => item.id),
          );
          await load();
        },
      });
      providerSortable = await initializeSortable();
    }
  }
  if (active.value === 'groups') {
    const body = groupTableRef.value?.$el?.querySelector(
      'tbody',
    ) as HTMLElement | null;
    if (body) {
      const { initializeSortable } = useSortable(body, {
        handle: '.aigc-drag-handle',
        async onEnd(event) {
          if (event.oldIndex === undefined || event.newIndex === undefined)
            return;
          const rows = [...groups.value];
          const [moved] = rows.splice(event.oldIndex, 1);
          if (!moved) return;
          rows.splice(event.newIndex, 0, moved);
          await AigcGatewayApi.reorderGroups(rows.map((item) => item.id));
          await load();
        },
      });
      groupSortable = await initializeSortable();
    }
  }
}
</script>

<template>
  <Page auto-content-height>
    <header class="heading">
      <h1>AI 网关</h1>
      <Button :loading="loading" @click="load">
        <template #icon><IconifyIcon icon="lucide:refresh-cw" /></template>刷新
      </Button>
    </header>
    <section class="stats">
      <Card size="small">
        <Statistic title="Provider" :value="overview.providers" />
</Card><Card size="small">
        <Statistic title="有效 API Key" :value="overview.active_keys" />
</Card><Card size="small">
        <Statistic title="请求" :value="overview.requests" />
</Card><Card size="small">
        <Statistic
          title="Token"
          :value="Number(overview.total_tokens)"
        />
</Card><Card size="small">
        <Statistic title="估算成本" :value="overview.total_cost" />
</Card><Card size="small">
        <Statistic title="熔断中" :value="overview.open_breakers" />
      </Card>
    </section>
    <Tabs v-model:active-key="active">
      <TabPane key="playground" tab="体验测试">
        <Playground :models="models" />
      </TabPane>
      <TabPane key="providers" tab="Provider">
        <Space class="toolbar">
          <Select
            v-model:value="selectedGroupId"
            class="group-filter"
            :options="groupOptions"
            placeholder="选择 Provider 分组"
          />
          <Button type="primary" @click="openProvider()">
            新建 Provider
          </Button>
</Space><Table
          ref="providerTableRef"
          :data-source="visibleProviders"
          :pagination="false"
          row-key="id"
          size="small"
          :columns="[
            { title: '', dataIndex: 'drag', width: 42 },
            { title: '名称', dataIndex: 'name' },
            { title: '编码', dataIndex: 'code' },
            { title: '协议', dataIndex: 'protocol' },
            { title: '凭证', dataIndex: 'credential_code' },
            { title: '优先级', dataIndex: 'priority' },
            { title: '权重', dataIndex: 'weight' },
            { title: '启用', dataIndex: 'enabled' },
          ]"
        >
          <template #bodyCell="{ column, record }">
            <GripVertical
              v-if="column.dataIndex === 'drag'"
              class="aigc-drag-handle size-4"
            />
            <Button
              v-else-if="column.dataIndex === 'name'"
              class="px-0"
              type="link"
              @click="openProvider(record)"
            >
              {{ record.name }}
            </Button>
            <Tag
              v-if="column.dataIndex === 'enabled'"
              :color="record.enabled ? 'success' : 'default'"
            >
              {{ record.enabled ? '启用' : '停用' }}
            </Tag>
            <span v-else-if="column.dataIndex === 'protocol'">
              {{ protocolLabel(record.protocol) }}
            </span>
          </template>
        </Table>
      </TabPane>
      <TabPane key="groups" tab="分组">
        <Button class="toolbar" type="primary" @click="openGroup()">
          新建分组
        </Button>
        <Table
          ref="groupTableRef"
          :data-source="groups"
          :pagination="false"
          row-key="id"
          size="small"
          :columns="[
            { title: '', dataIndex: 'drag', width: 42 },
            { title: '名称', dataIndex: 'name' },
            { title: '编码', dataIndex: 'code' },
            { title: '策略', dataIndex: 'load_strategy' },
            { title: '优先级', dataIndex: 'priority' },
          ]"
        >
          <template #bodyCell="{ column, record }">
            <GripVertical
              v-if="column.dataIndex === 'drag'"
              class="aigc-drag-handle size-4"
            />
            <Button
              v-else-if="column.dataIndex === 'name'"
              class="px-0"
              type="link"
              @click="openGroup(record)"
            >
              {{ record.name }}
            </Button>
          </template>
        </Table>
      </TabPane>
      <TabPane key="models" tab="模型路由">
        <Button class="toolbar" type="primary" @click="openModel()">
          新建模型
</Button><Table
          :data-source="models"
          :pagination="false"
          row-key="id"
          size="small"
          :columns="[
            { title: '内部模型', dataIndex: 'canonical_model' },
            { title: '上游模型', dataIndex: 'upstream_model' },
            { title: 'Provider ID', dataIndex: 'provider_id' },
            { title: '能力', dataIndex: 'capabilities' },
            { title: '输入/百万', dataIndex: 'input_price' },
            { title: '输出/百万', dataIndex: 'output_price' },
          ]"
        >
          <template #bodyCell="{ column, record }">
            <Button
              v-if="column.dataIndex === 'canonical_model'"
              class="px-0"
              type="link"
              @click="openModel(record)"
            >
              {{ record.canonical_model }}
            </Button>
            <span v-else-if="column.dataIndex === 'provider_id'">
              {{ providerName(record.provider_id) }}
            </span>
            <Space v-else-if="column.dataIndex === 'capabilities'" :size="4">
              <Tag
                v-for="capability in record.capabilities ?? ['chat']"
                :key="capability"
              >
                {{
                  capabilityOptions.find((item) => item.value === capability)
                    ?.label ?? capability
                }}
              </Tag>
            </Space>
          </template>
        </Table>
      </TabPane>
      <TabPane key="keys" tab="API Key">
        <Button class="toolbar" type="primary" @click="openKey">
          签发 API Key
</Button><Table
          :data-source="keys"
          :pagination="false"
          row-key="id"
          size="small"
          :columns="[
            { title: '名称', dataIndex: 'name' },
            { title: '前缀', dataIndex: 'key_prefix' },
            { title: '用户', dataIndex: 'owner_uid' },
            { title: '状态', dataIndex: 'state' },
            { title: '最近使用', dataIndex: 'last_used_at' },
          ]"
        >
          <template #bodyCell="{ column, record }">
            <Button
              v-if="column.dataIndex === 'state'"
              :disabled="record.state !== 'active'"
              danger
              type="link"
              @click="disableKey(record)"
            >
              {{ record.state === 'active' ? '有效（点击停用）' : '已停用' }}
            </Button>
          </template>
        </Table>
      </TabPane>
      <TabPane key="requests" tab="请求记录">
        <Table
          :data-source="requests"
          :pagination="false"
          row-key="id"
          size="small"
          :scroll="{ x: 1200 }"
          :columns="[
            { title: 'Trace', dataIndex: 'trace_id', width: 180 },
            { title: '模型', dataIndex: 'requested_model' },
            { title: 'Provider', dataIndex: 'provider_code' },
            { title: '状态', dataIndex: 'state' },
            { title: 'HTTP', dataIndex: 'http_status' },
            { title: '输入', dataIndex: 'prompt_tokens' },
            { title: '输出', dataIndex: 'completion_tokens' },
            { title: '成本', dataIndex: 'cost' },
            { title: '尝试', dataIndex: 'attempt_count' },
            { title: '耗时ms', dataIndex: 'elapsed_ms' },
            { title: '错误', dataIndex: 'error_message' },
          ]"
        />
      </TabPane>
      <TabPane key="breakers" tab="熔断">
        <Table
          :data-source="breakers"
          :pagination="false"
          row-key="id"
          size="small"
          :columns="[
            { title: 'Provider', dataIndex: 'provider_code' },
            { title: '模型', dataIndex: 'canonical_model' },
            { title: '失败', dataIndex: 'failure_count' },
            { title: '成功', dataIndex: 'success_count' },
            { title: '开放截止', dataIndex: 'open_until' },
            { title: '错误', dataIndex: 'last_error' },
          ]"
        >
          <template #bodyCell="{ column, record }">
            <Button
              v-if="column.dataIndex === 'provider_code'"
              class="px-0"
              type="link"
              @click="resetBreaker(record)"
            >
              {{ record.provider_code }}
            </Button>
          </template>
        </Table>
      </TabPane>
      <TabPane key="media" tab="图片/视频任务">
        <Table
          :data-source="mediaJobs"
          :pagination="false"
          row-key="id"
          size="small"
          :columns="[
            { title: 'ID', dataIndex: 'id' },
            { title: '类型', dataIndex: 'media_type' },
            { title: '模型', dataIndex: 'model' },
            { title: '状态', dataIndex: 'state' },
            { title: 'TaskRun', dataIndex: 'task_run_id' },
            { title: '错误', dataIndex: 'error_message' },
          ]"
        />
      </TabPane>
    </Tabs>
    <Modal
      :open="!!modal"
      width="min(920px, calc(100vw - 32px))"
      :title="
        modal === 'group'
          ? 'Provider 分组'
          : modal === 'provider'
            ? 'Provider'
            : modal === 'model'
              ? '模型路由'
              : '签发 API Key'
      "
      @cancel="modal = undefined"
      @ok="save"
    >
      <Form class="modal-form" layout="vertical">
        <template v-if="modal === 'group'">
          <div class="form-grid three">
            <FormItem label="编码">
              <Input v-model:value="groupForm.code" />
</FormItem><FormItem label="名称">
              <Input v-model:value="groupForm.name" />
</FormItem><FormItem label="策略">
              <Select
                v-model:value="groupForm.load_strategy"
                :options="strategyOptions"
              />
</FormItem><FormItem label="优先级">
              <InputNumber
                v-model:value="groupForm.priority"
                class="w-full"
              />
</FormItem><FormItem label="启用">
              <Switch v-model:checked="groupForm.enabled" />
            </FormItem>
          </div>
        </template>
        <template v-else-if="modal === 'provider'">
          <div class="form-grid three">
            <FormItem label="分组">
              <Select
                v-model:value="providerForm.group_id"
                :options="groupOptions"
              />
</FormItem><FormItem label="编码">
              <Input v-model:value="providerForm.code" />
</FormItem><FormItem label="名称">
              <Input v-model:value="providerForm.name" />
</FormItem><FormItem label="协议">
              <Select
                v-model:value="providerForm.protocol"
                :options="protocolOptions"
                @change="selectProviderProtocol"
              />
</FormItem><FormItem label="Base URL">
              <Input v-model:value="providerForm.base_url" />
</FormItem><FormItem label="授权凭证">
              <CredentialSelect
                v-model="providerForm.credential_code"
                :kinds="
                  isHttpProviderProtocol(providerForm.protocol)
                    ? ['http_header', 'http_token', 'password']
                    : ['access_key']
                "
                :create-kind="defaultCredentialKind(providerForm.protocol)"
                placeholder="选择 Provider 授权凭证"
              />
            </FormItem>
            <FormItem label="权重">
              <InputNumber
                class="w-full"
                v-model:value="providerForm.weight"
                :min="1"
              />
</FormItem><FormItem label="失败阈值">
              <InputNumber
                class="w-full"
                v-model:value="providerForm.fail_threshold"
                :min="1"
              />
</FormItem><FormItem label="熔断秒数">
              <InputNumber
                class="w-full"
                v-model:value="providerForm.open_duration_secs"
                :min="1"
              />
            </FormItem>
            <FormItem label="立即熔断状态码">
              <Select
                v-model:value="providerForm.breaker_statuses"
                mode="multiple"
                :options="breakerStatusOptions"
              />
</FormItem><FormItem label="启用">
              <Switch v-model:checked="providerForm.enabled" />
            </FormItem>
          </div>
        </template>
        <template v-else-if="modal === 'model'">
          <div class="form-grid three">
            <FormItem label="Provider">
              <Select
                v-model:value="modelForm.provider_id"
                :options="providerOptions"
                @change="selectModelProvider"
              />
</FormItem><FormItem label="内部模型 ID">
              <Input v-model:value="modelForm.canonical_model" />
</FormItem><FormItem label="上游模型 ID">
              <Select
                v-if="editingProviderIsJimeng"
                v-model:value="modelForm.upstream_model"
                :options="jimengModelOptions"
                @change="selectJimengModel"
              />
              <Input
                v-else
                v-model:value="modelForm.upstream_model"
              />
</FormItem><FormItem label="别名">
              <Select
                v-model:value="modelForm.aliases"
                mode="tags"
                placeholder="输入别名后回车"
              />
            </FormItem>
            <FormItem label="模型能力">
              <Select
                v-model:value="modelForm.capabilities"
                mode="multiple"
                :disabled="
                  editingProviderIsJimeng || editingProviderCapabilitiesLocked
                "
                :options="capabilityOptions"
              />
            </FormItem>
            <FormItem label="输入/百万 Token">
              <Input v-model:value="modelForm.input_price" />
</FormItem><FormItem label="输出/百万 Token">
              <Input v-model:value="modelForm.output_price" />
            </FormItem>
            <FormItem label="启用">
              <Switch v-model:checked="modelForm.enabled" />
            </FormItem>
          </div>
        </template>
        <template v-else>
          <div class="form-grid three">
            <FormItem label="名称">
              <Input v-model:value="keyForm.name" />
</FormItem><FormItem label="关联用户 UID">
              <InputNumber
                v-model:value="keyForm.owner_uid"
                class="w-full"
              />
</FormItem><FormItem label="允许模型">
              <Select
                v-model:value="keyForm.allowed_models"
                mode="multiple"
                :options="modelOptions"
              />
</FormItem><FormItem v-if="issuedKey" label="API Key">
              <TextArea :value="issuedKey" readonly :rows="3" />
            </FormItem>
          </div>
        </template>
      </Form>
    </Modal>
  </Page>
</template>

<style scoped>
.heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.heading h1 {
  margin: 0;
  font-size: 22px;
}

.stats {
  display: grid;
  grid-template-columns: repeat(6, minmax(110px, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.toolbar {
  margin-bottom: 10px;
}

.form-grid {
  display: grid;
  gap: 0 16px;
}

.form-grid.three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.group-filter {
  width: 240px;
}

.aigc-drag-handle {
  color: var(--vben-text-color-secondary);
  cursor: grab;
}

@media (max-width: 900px) {
  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .form-grid.three {
    grid-template-columns: 1fr;
  }
}
</style>
