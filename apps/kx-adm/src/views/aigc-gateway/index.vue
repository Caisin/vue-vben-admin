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

import { computed, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

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
import { CredentialApi } from '#/api/credential';

const loading = ref(false);
const active = ref('providers');
const breakers = ref<GatewayBreaker[]>([]);
const groups = ref<ProviderGroup[]>([]);
const keys = ref<GatewayApiKey[]>([]);
const mediaJobs = ref<GatewayMediaJob[]>([]);
const models = ref<ModelRoute[]>([]);
const providers = ref<Provider[]>([]);
const requests = ref<GatewayRequest[]>([]);
const credentials = ref<{ label: string; value: string }[]>([]);
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
  breaker_statuses: '401,403,429',
});
const modelForm = reactive({
  provider_id: undefined as number | string | undefined,
  canonical_model: '',
  upstream_model: '',
  aliases: '',
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
const modelOptions = computed(() =>
  [...new Set(models.value.map((v) => v.canonical_model))].map((v) => ({
    label: v,
    value: v,
  })),
);
const strategyOptions = [
  { label: '优先级', value: 'priority' },
  { label: '轮询', value: 'round_robin' },
  { label: '加权随机', value: 'weighted_random' },
];
async function load() {
  loading.value = true;
  try {
    const [o, g, p, m, k, r, b, j, c] = await Promise.all([
      AigcGatewayApi.overview(),
      AigcGatewayApi.groups(),
      AigcGatewayApi.providers(),
      AigcGatewayApi.models(),
      AigcGatewayApi.keys(),
      AigcGatewayApi.requests({ page: 1, size: 100 }),
      AigcGatewayApi.breakers(),
      AigcGatewayApi.mediaJobs(),
      CredentialApi.all({ state: 'active' }),
    ]);
    overview.value = o;
    groups.value = g;
    providers.value = p;
    models.value = m;
    keys.value = k;
    requests.value = r.items;
    breakers.value = b;
    mediaJobs.value = j;
    credentials.value = c
      .filter((v) => ['http_header', 'http_token', 'password'].includes(v.kind))
      .map((v) => ({ label: `${v.name} (${v.code})`, value: v.code }));
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
      ? { ...v, breaker_statuses: v.breaker_statuses.join(',') }
      : {
          group_id: groups.value[0]?.id,
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
          breaker_statuses: '401,403,429',
        },
  );
  modal.value = 'provider';
}
function openModel(v?: ModelRoute) {
  editingId.value = v?.id;
  Object.assign(
    modelForm,
    v
      ? { ...v, aliases: v.aliases.join(',') }
      : {
          provider_id: providers.value[0]?.id,
          canonical_model: '',
          upstream_model: '',
          aliases: '',
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
        breaker_statuses: providerForm.breaker_statuses
          .split(',')
          .map((value) => +value)
          .filter((value) => Number.isFinite(value)),
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
        aliases: modelForm.aliases
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean),
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
  await AigcGatewayApi.disableKey(v.id);
  await load();
}
async function resetBreaker(v: GatewayBreaker) {
  await AigcGatewayApi.resetBreaker(v.id);
  await load();
}
onMounted(load);
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
      <TabPane key="providers" tab="Provider">
        <Space class="toolbar">
          <Button @click="openGroup()">新建分组</Button><Button type="primary" @click="openProvider()">
            新建 Provider
          </Button>
</Space><Table
          :data-source="providers"
          :pagination="false"
          row-key="id"
          size="small"
          :columns="[
            { title: '名称', dataIndex: 'name' },
            { title: '编码', dataIndex: 'code' },
            { title: '协议', dataIndex: 'protocol' },
            { title: '凭证', dataIndex: 'credential_code' },
            { title: '优先级', dataIndex: 'priority' },
            { title: '权重', dataIndex: 'weight' },
            { title: '启用', dataIndex: 'enabled' },
            { title: '操作', dataIndex: 'op' },
          ]"
        >
          <template #bodyCell="{ column, record }">
            <Tag
              v-if="column.dataIndex === 'enabled'"
              :color="record.enabled ? 'success' : 'default'"
            >
              {{ record.enabled ? '启用' : '停用' }}
</Tag><Button
              v-else-if="column.dataIndex === 'op'"
              type="link"
              @click="openProvider(record)"
            >
              编辑
            </Button>
          </template>
        </Table>
      </TabPane>
      <TabPane key="groups" tab="分组">
        <Table
          :data-source="groups"
          :pagination="false"
          row-key="id"
          size="small"
          :columns="[
            { title: '名称', dataIndex: 'name' },
            { title: '编码', dataIndex: 'code' },
            { title: '策略', dataIndex: 'load_strategy' },
            { title: '优先级', dataIndex: 'priority' },
            { title: '操作', dataIndex: 'op' },
          ]"
        >
          <template #bodyCell="{ column, record }">
            <Button
              v-if="column.dataIndex === 'op'"
              type="link"
              @click="openGroup(record)"
            >
              编辑
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
            { title: '输入/百万', dataIndex: 'input_price' },
            { title: '输出/百万', dataIndex: 'output_price' },
            { title: '操作', dataIndex: 'op' },
          ]"
        >
          <template #bodyCell="{ column, record }">
            <Button
              v-if="column.dataIndex === 'op'"
              type="link"
              @click="openModel(record)"
            >
              编辑
            </Button>
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
            { title: '操作', dataIndex: 'op' },
          ]"
        >
          <template #bodyCell="{ column, record }">
            <Button
              v-if="column.dataIndex === 'op'"
              :disabled="record.state !== 'active'"
              danger
              type="link"
              @click="disableKey(record)"
            >
              停用
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
            { title: '操作', dataIndex: 'op' },
          ]"
        >
          <template #bodyCell="{ column, record }">
            <Button
              v-if="column.dataIndex === 'op'"
              type="link"
              @click="resetBreaker(record)"
            >
              恢复
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
      <Form layout="vertical">
        <template v-if="modal === 'group'">
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
        </template>
        <template v-else-if="modal === 'provider'">
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
              :options="[{ label: 'OpenAI', value: 'openai' }]"
            />
</FormItem><FormItem label="Base URL">
            <Input v-model:value="providerForm.base_url" />
</FormItem><FormItem label="授权凭证">
            <Select
              v-model:value="providerForm.credential_code"
              show-search
              :options="credentials"
            />
          </FormItem>
          <div class="two">
            <FormItem label="组内优先级">
              <InputNumber v-model:value="providerForm.priority" />
</FormItem><FormItem label="权重">
              <InputNumber
                v-model:value="providerForm.weight"
                :min="1"
              />
</FormItem><FormItem label="失败阈值">
              <InputNumber
                v-model:value="providerForm.fail_threshold"
                :min="1"
              />
</FormItem><FormItem label="熔断秒数">
              <InputNumber
                v-model:value="providerForm.open_duration_secs"
                :min="1"
              />
            </FormItem>
          </div>
          <FormItem label="立即熔断状态码">
            <Input v-model:value="providerForm.breaker_statuses" />
</FormItem><FormItem label="启用">
            <Switch v-model:checked="providerForm.enabled" />
          </FormItem>
        </template>
        <template v-else-if="modal === 'model'">
          <FormItem label="Provider">
            <Select
              v-model:value="modelForm.provider_id"
              :options="providerOptions"
            />
</FormItem><FormItem label="内部模型 ID">
            <Input v-model:value="modelForm.canonical_model" />
</FormItem><FormItem label="上游模型 ID">
            <Input v-model:value="modelForm.upstream_model" />
</FormItem><FormItem label="别名">
            <Input v-model:value="modelForm.aliases" placeholder="逗号分隔" />
          </FormItem>
          <div class="two">
            <FormItem label="输入/百万 Token">
              <Input v-model:value="modelForm.input_price" />
</FormItem><FormItem label="输出/百万 Token">
              <Input v-model:value="modelForm.output_price" />
            </FormItem>
          </div>
          <FormItem label="启用">
            <Switch v-model:checked="modelForm.enabled" />
          </FormItem>
        </template>
        <template v-else>
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

.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

@media (max-width: 900px) {
  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .two {
    grid-template-columns: 1fr;
  }
}
</style>
