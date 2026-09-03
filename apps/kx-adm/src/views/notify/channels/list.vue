<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  NotifyChannel,
  NotifyChannelStatus,
  NotifyChannelType,
  NotifyChannelWrite,
  NotifyProviderOption,
} from '#/api';

import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';
import { Ellipsis, Plus } from '@vben/icons';

import {
  Form as AForm,
  Button,
  Dropdown,
  FormItem,
  Input,
  InputNumber,
  Menu,
  MenuItem,
  message,
  Popconfirm,
  Select,
  Space,
  TabPane,
  Tabs,
} from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { NotifyChannelApi } from '#/api';
import {
  ConfigGuide,
  FieldHelp,
  ReferenceSelect,
} from '#/components/management';
import { Times } from '#/times';
import { vxeSortParams } from '#/vxe-sort';

import { channelConfigGuides } from '../config-guides';
import MessageList from '../messages/list.vue';
import {
  channelColumns,
  channelStatusOptions,
  channelTypeLabel,
  useFormSchema,
} from './data';
import PopupDrawer from './modules/popup-drawer.vue';
import ProviderQuickCreate from './modules/provider-quick-create.vue';

const channelSortFields = [
  'id',
  'channel_code',
  'channel_name',
  'updated_at',
  'created_at',
];
const route = useRoute();
const drawerOpen = ref(false);
const drawerSaving = ref(false);
const editingId = ref<number | string>();
const selectedChannel = ref<NotifyChannel>();
const activeTab = ref<'channels' | 'messages'>('channels');
const messageListRef = ref<{ refresh: () => Promise<void> }>();
const providerOptions = ref<NotifyProviderOption[]>([]);
const providerOptionsLoading = ref(false);
const form = reactive<NotifyChannelWrite>({
  channel_code: '',
  channel_name: '',
  channel_type: 'dingtalk_custom_robot',
  config: {},
  max_retry_count: 3,
  provider_code: '',
  rate_limit_per_minute: 20,
  retry_delay_seconds: 60,
  status: 'enabled',
});
const registeredChannelTypeOptions = computed(() => {
  const options = providerOptions.value.map((item) => ({
    label: item.display_name,
    value: item.channel_type,
  }));
  if (
    editingId.value &&
    !options.some((item) => item.value === form.channel_type)
  ) {
    options.unshift({
      label: channelTypeLabel(form.channel_type),
      value: form.channel_type,
    });
  }
  return options;
});
const selectedProvider = computed(() =>
  providerOptions.value.find((item) => item.channel_type === form.channel_type),
);
const providerConfigOptions = computed(() => {
  const options = (selectedProvider.value?.config_options ?? []).map(
    (item) => ({
      description: item.description,
      label: `${item.display_name} (${item.provider_code})`,
      value: item.provider_code,
    }),
  );
  if (
    form.provider_code &&
    !options.some((item) => item.value === form.provider_code)
  ) {
    options.unshift({
      description: '历史配置当前不在可选列表中',
      label: `当前配置 (${form.provider_code})`,
      value: form.provider_code,
    });
  }
  return options;
});
const selectedProviderConfigDescription = computed(
  () =>
    providerConfigOptions.value.find(
      (item) => item.value === form.provider_code,
    )?.description,
);
const selectedConfigGuide = computed(
  () => channelConfigGuides[form.channel_type],
);
const providerConfigTarget = computed(() => {
  if (form.channel_type === 'dingtalk_custom_robot') {
    return {
      label: '维护钉钉自定义机器人',
      path: '/notify/dingtalk',
      query: { tab: 'custom' },
    };
  }
  if (form.channel_type === 'dingtalk_group_bot') {
    return {
      label: '维护钉钉企业群机器人',
      path: '/notify/dingtalk',
      query: { tab: 'group' },
    };
  }
  if (form.channel_type === 'push') {
    return {
      label: '维护 Firebase 服务账号',
      path: '/credential/items',
      query: { kind: 'google_service_account', profile: 'firebase_fcm' },
    };
  }
  return { label: '打开参数管理', path: '/param/parameters', query: undefined };
});

const [Grid, gridApi] = useVbenVxeGrid<NotifyChannel>({
  formOptions: { schema: useFormSchema(), submitOnChange: true },
  gridEvents: {
    cellClick({ row }: { row: NotifyChannel }) {
      selectedChannel.value = row;
    },
  },
  gridOptions: {
    columns: channelColumns(onStatusChange),
    height: '100%',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async (params, formValues) => {
          const { page } = params;
          const result = await NotifyChannelApi.list({
            channel_code_prefix:
              String(formValues.channel_code_prefix ?? '').trim() || undefined,
            channel_type: formValues.channel_type as
              | NotifyChannelType
              | undefined,
            page: page.currentPage,
            size: page.pageSize,
            status: formValues.status as NotifyChannelStatus | undefined,
            ...vxeSortParams(params, channelSortFields),
          });
          selectedChannel.value =
            result.items.find(
              (item) => String(item.id) === String(selectedChannel.value?.id),
            ) ?? result.items[0];
          return { items: result.items, total: result.total };
        },
      },
    },
    rowConfig: { keyField: 'id' },
    sortConfig: { remote: true },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<NotifyChannel>,
});

onMounted(async () => {
  await loadProviderOptions();
  if (route.query.action === 'create') {
    const requestedType = String(route.query.channel_type ?? '');
    openCreate(
      requestedType === 'dingtalk_group_bot'
        ? 'dingtalk_group_bot'
        : 'dingtalk_custom_robot',
    );
  }
});

watch(activeTab, async (tab) => {
  if (tab !== 'messages') return;
  await nextTick();
  await messageListRef.value?.refresh();
});

async function loadProviderOptions(keyword = '') {
  providerOptionsLoading.value = true;
  try {
    const result = await NotifyChannelApi.provider_options({
      keyword: keyword.trim() || undefined,
    });
    providerOptions.value = result.providers;
    if (
      !editingId.value &&
      !providerOptions.value.some(
        (item) => item.channel_type === form.channel_type,
      )
    ) {
      form.channel_type =
        providerOptions.value[0]?.channel_type ?? 'dingtalk_custom_robot';
    }
    applySingleProviderDefault();
  } finally {
    providerOptionsLoading.value = false;
  }
}

async function refreshProviderOptions() {
  await loadProviderOptions();
  message.success('Provider 配置列表已刷新');
}

async function searchProviderOptions(keyword: string) {
  await loadProviderOptions(keyword);
}

function resetForm(row?: NotifyChannel) {
  editingId.value = row?.id;
  Object.assign(form, {
    channel_code: row?.channel_code ?? '',
    channel_name: row?.channel_name ?? '',
    channel_type: row?.channel_type ?? 'dingtalk_custom_robot',
    config: row?.config ?? {},
    max_retry_count: Number(row?.max_retry_count ?? 3),
    provider_code: row?.provider_code ?? '',
    rate_limit_per_minute: Number(row?.rate_limit_per_minute ?? 20),
    retry_delay_seconds: Number(row?.retry_delay_seconds ?? 60),
    status: row?.status ?? 'enabled',
  });
  applySingleProviderDefault();
}

function openCreate(channelType?: NotifyChannelType) {
  resetForm();
  if (channelType) {
    form.channel_type = channelType;
    form.provider_code = '';
    applySingleProviderDefault();
  }
  drawerOpen.value = true;
}

function openCreateFromToolbar() {
  openCreate();
}

function openEdit(row: NotifyChannel) {
  selectedChannel.value = row;
  resetForm(row);
  drawerOpen.value = true;
}

function applySingleProviderDefault() {
  if (editingId.value || form.provider_code) return;
  const options = selectedProvider.value?.config_options ?? [];
  if (options.length === 1 && options[0]) {
    form.provider_code = options[0].provider_code;
  }
}

function onChannelTypeChange(value: unknown) {
  form.channel_type = value as NotifyChannelType;
  form.provider_code = '';
  form.config = {};
  applySingleProviderDefault();
}

function buildPayload(): NotifyChannelWrite {
  if (!form.channel_code.trim() || !form.channel_name.trim()) {
    throw new Error('通道编码和通道名称不能为空');
  }
  if (!form.provider_code.trim()) {
    throw new Error('请选择 Provider 配置');
  }
  return {
    channel_code: form.channel_code.trim(),
    channel_name: form.channel_name.trim(),
    channel_type: form.channel_type,
    config:
      form.config &&
      !Array.isArray(form.config) &&
      typeof form.config === 'object'
        ? form.config
        : {},
    max_retry_count: Number(form.max_retry_count ?? 3),
    provider_code: form.provider_code.trim(),
    rate_limit_per_minute: Number(form.rate_limit_per_minute ?? 20),
    retry_delay_seconds: Number(form.retry_delay_seconds ?? 60),
    status: form.status,
  };
}

async function onStatusChange(status: NotifyChannelStatus, row: NotifyChannel) {
  await NotifyChannelApi.update(row.id, {
    channel_code: row.channel_code,
    channel_name: row.channel_name,
    channel_type: row.channel_type,
    config: row.config,
    max_retry_count: row.max_retry_count,
    provider_code: row.provider_code,
    rate_limit_per_minute: row.rate_limit_per_minute,
    retry_delay_seconds: Number(row.retry_delay_seconds),
    status,
  });
  return true;
}

async function saveChannel() {
  let payload: NotifyChannelWrite;
  try {
    payload = buildPayload();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '通道配置无效');
    return;
  }
  drawerSaving.value = true;
  try {
    if (editingId.value) {
      selectedChannel.value = await NotifyChannelApi.update(
        editingId.value,
        payload,
      );
      message.success('消息通道已更新');
    } else {
      selectedChannel.value = await NotifyChannelApi.create(payload);
      message.success('消息通道已创建');
    }
    drawerOpen.value = false;
    await gridApi.reload();
  } finally {
    drawerSaving.value = false;
  }
}

async function removeChannel(row: NotifyChannel) {
  await NotifyChannelApi.remove(row.id);
  if (String(selectedChannel.value?.id) === String(row.id)) {
    selectedChannel.value = undefined;
  }
  message.success('消息通道已删除或禁用');
  await gridApi.reload();
}

async function testChannel(row: NotifyChannel) {
  selectedChannel.value = row;
  const msg = await NotifyChannelApi.test(row.id);
  message.success(msg.duplicate ? '已有测试消息在队列中' : '测试消息已入队');
  await gridApi.reload();
  await messageListRef.value?.refresh();
}

function showChannelMessages(row: NotifyChannel) {
  selectedChannel.value = row;
  activeTab.value = 'messages';
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <Tabs v-model:active-key="activeTab" class="notify-tabs">
      <TabPane key="channels" tab="消息通道">
        <section class="tab-panel">
          <Grid class="management-grid" table-title="消息通道">
            <template #toolbar-tools>
              <Button
                v-access:code="'notify:channel:write'"
                type="primary"
                @click="openCreateFromToolbar"
              >
                <template #icon><Plus /></template>创建通道
              </Button>
            </template>
            <template #channelName="{ row }">
              <Button
                v-access:code="'notify:channel:write'"
                class="px-0"
                type="link"
                @click.stop="openEdit(row)"
              >
                {{ row.channel_name }}
              </Button>
            </template>
            <template #channelType="{ row }">
              {{ channelTypeLabel(row.channel_type) }}
            </template>
            <template #updatedAt="{ row }">
              {{ Times.formatOptionalUnix(row.updated_at) }}
            </template>
            <template #operation="{ row }">
              <Space>
                <Button
                  size="small"
                  type="link"
                  @click.stop="showChannelMessages(row)"
                >
                  消息
                </Button>
                <Dropdown>
                  <Button size="small" title="更多操作" type="text">
                    <Ellipsis class="size-4" />
                  </Button>
                  <template #popupRender>
                    <Menu>
                      <MenuItem
                        v-access:code="'notify:channel:test'"
                        key="test"
                        @click="testChannel(row)"
                      >
                        发送测试消息
                      </MenuItem>
                      <Popconfirm
                        :title="`确认删除或停用通道 ${row.channel_name}？历史消息和审计记录会保留。`"
                        @confirm="removeChannel(row)"
                      >
                        <MenuItem
                          v-access:code="'notify:channel:write'"
                          danger
                          key="remove"
                        >
                          删除或停用
                        </MenuItem>
                      </Popconfirm>
                    </Menu>
                  </template>
                </Dropdown>
              </Space>
            </template>
          </Grid>
        </section>
      </TabPane>
      <TabPane key="messages" tab="推送消息">
        <section class="tab-panel">
          <MessageList
            ref="messageListRef"
            :channel="selectedChannel"
            embedded
          />
        </section>
      </TabPane>
    </Tabs>

    <PopupDrawer
      v-model:open="drawerOpen"
      destroy-on-close
      :title="editingId ? '编辑消息通道' : '创建消息通道'"
      width="720"
    >
      <AForm layout="vertical">
        <div class="form-grid">
          <FormItem>
            <template #label>
              <FieldHelp
                help="业务入队时引用的稳定编码；创建后不要随展示名称一起修改。"
                label="通道编码"
              />
            </template>
            <Input v-model:value="form.channel_code" />
          </FormItem>
          <FormItem label="通道名称">
            <Input v-model:value="form.channel_name" />
          </FormItem>
          <FormItem>
            <template #label>
              <FieldHelp
                help="决定运行时使用的 Provider，并联动加载该类型当前可用的配置。"
                label="通道类型"
              />
            </template>
            <Select
              v-model:value="form.channel_type"
              :options="registeredChannelTypeOptions"
              :loading="providerOptionsLoading"
              @change="onChannelTypeChange"
            />
            <div v-if="selectedProvider?.description" class="muted-summary">
              {{ selectedProvider.description }}
            </div>
          </FormItem>
          <ConfigGuide
            v-if="selectedConfigGuide"
            class="full-row"
            v-bind="selectedConfigGuide"
          />
          <FormItem>
            <template #label>
              <FieldHelp
                help="选择对应 Provider 已配置的机器人或机密参数；列表不会返回 URL、token 或 secret。"
                label="Provider 配置"
              />
            </template>
            <ReferenceSelect
              v-model:model-value="form.provider_code"
              :loading="providerOptionsLoading"
              :options="providerConfigOptions"
              placeholder="请选择 Provider 配置"
              :manage-path="providerConfigTarget.path"
              :manage-query="providerConfigTarget.query"
              maintenance-title="新增 Provider 配置"
              :show-maintenance="true"
              :show-manage="true"
              @refresh="refreshProviderOptions"
              @search="searchProviderOptions"
            >
              <template #maintenance="{ complete }">
                <ProviderQuickCreate
                  :channel-type="form.channel_type"
                  @success="complete"
                />
              </template>
            </ReferenceSelect>
            <div v-if="selectedProviderConfigDescription" class="muted-summary">
              {{ selectedProviderConfigDescription }}
            </div>
          </FormItem>
          <FormItem>
            <template #label>
              <FieldHelp
                help="停用后保留历史消息和审计记录，但调度器不再通过该通道投递。"
                label="状态"
              />
            </template>
            <Select
              v-model:value="form.status"
              :options="channelStatusOptions"
            />
          </FormItem>
          <FormItem>
            <template #label>
              <FieldHelp
                help="单通道每分钟最多投递数量；填 0 表示不启用平台限速。"
                label="每分钟限速"
              />
            </template>
            <InputNumber
              v-model:value="form.rate_limit_per_minute"
              class="w-full"
              :min="0"
            />
          </FormItem>
          <FormItem>
            <template #label>
              <FieldHelp
                help="单条消息默认最大尝试次数；消息入队时可单独覆盖。"
                label="最大重试次数"
              />
            </template>
            <InputNumber
              v-model:value="form.max_retry_count"
              class="w-full"
              :min="0"
            />
          </FormItem>
          <FormItem>
            <template #label>
              <FieldHelp
                help="投递失败后再次进入可扫描状态前的等待秒数。"
                label="重试延迟秒"
              />
            </template>
            <InputNumber
              v-model:value="form.retry_delay_seconds"
              class="w-full"
              :min="1"
            />
          </FormItem>
        </div>
      </AForm>
      <template #footer>
        <Space>
          <Button @click="drawerOpen = false"> 取消 </Button>
          <Button :loading="drawerSaving" type="primary" @click="saveChannel">
            保存
          </Button>
        </Space>
      </template>
    </PopupDrawer>
  </Page>
</template>

<style scoped>
.management-page {
  min-height: 0;
}

.management-page :deep(.management-content) {
  height: 100%;
  min-height: 0;
  overflow: auto;
}

.notify-tabs {
  height: 100%;
  min-height: 520px;
}

.notify-tabs :deep(.ant-tabs-content-holder),
.notify-tabs :deep(.ant-tabs-content),
.notify-tabs :deep(.ant-tabs-tabpane),
.tab-panel,
.management-grid {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.management-grid {
  height: 100%;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 16px;
}

.full-row {
  grid-column: 1 / -1;
}

.muted-summary {
  margin-top: 6px;
  font-size: 12px;
  color: #6b7280;
}

@media (max-width: 900px) {
  .management-page :deep(.management-content) {
    overflow: auto;
  }

  .notify-tabs {
    min-height: 620px;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
