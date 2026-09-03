<script lang="ts" setup>
import type {
  CredentialBindingView,
  CredentialProfileSpec,
  CredentialView,
} from '#/api/credential';

import { computed, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenDrawer } from '@vben/common-ui';

import {
  Button,
  Descriptions,
  DescriptionsItem,
  Empty,
  Segmented,
  Space,
  Table,
  TabPane,
  Tabs,
  Tag,
} from 'antdv-next';

import { CredentialApi } from '#/api/credential';
import { Times } from '#/times';

import {
  expiryInfo,
  kindLabel,
  profileLabel,
  stateLabel,
  stateOptions,
  summaryText,
} from '../data';

const emit = defineEmits<{
  edit: [CredentialView];
  replace: [CredentialView];
  retire: [CredentialView];
  reveal: [CredentialView];
  status: [CredentialView];
}>();

const credential = ref<CredentialView>();
const profiles = ref<CredentialProfileSpec[]>([]);
const activeTab = ref('overview');
const bindings = ref<CredentialBindingView[]>([]);
const bindingsLoaded = ref(false);
const bindingsLoading = ref(false);
const bindingFilter = ref<'all' | 'error' | 'unused'>('all');
const bindingColumns = [
  { dataIndex: 'consumer', title: '消费者', width: 120 },
  { dataIndex: 'owner_type', title: '对象类型', width: 140 },
  { dataIndex: 'owner_key', title: '对象键' },
  { dataIndex: 'slot', title: '用途', width: 120 },
  { dataIndex: 'last_used_at', title: '最后使用', width: 170 },
  { dataIndex: 'last_error', title: '最近错误', width: 220 },
];
const filteredBindings = computed(() => {
  if (bindingFilter.value === 'error') {
    return bindings.value.filter((item) => item.last_error.trim());
  }
  if (bindingFilter.value === 'unused') {
    return bindings.value.filter((item) => Number(item.last_used_at) <= 0);
  }
  return bindings.value;
});
const { hasAccessByCodes } = useAccess();
const stateColor = computed(
  () =>
    stateOptions.find((item) => item.value === credential.value?.state)?.color,
);

const [Drawer, drawerApi] = useVbenDrawer<{
  item: CredentialView;
  profiles: CredentialProfileSpec[];
}>({
  onOpenChange(open) {
    if (!open) {
      credential.value = undefined;
      profiles.value = [];
      activeTab.value = 'overview';
      bindings.value = [];
      bindingsLoaded.value = false;
      bindingFilter.value = 'all';
      return;
    }
    const data = drawerApi.getData();
    credential.value = data?.item;
    profiles.value = data?.profiles ?? [];
  },
});

async function loadBindings() {
  if (!credential.value || bindingsLoaded.value) return;
  bindingsLoading.value = true;
  try {
    bindings.value = await CredentialApi.bindings(credential.value.code);
    bindingsLoaded.value = true;
  } finally {
    bindingsLoading.value = false;
  }
}

function handleTabChange(key: string) {
  activeTab.value = key;
  if (key === 'bindings') void loadBindings();
}

function closeAndEmit(
  event: 'edit' | 'replace' | 'retire' | 'reveal' | 'status',
) {
  if (!credential.value) return;
  const item = credential.value;
  drawerApi.close();
  switch (event) {
    case 'edit': {
      emit('edit', item);
      break;
    }
    case 'replace': {
      emit('replace', item);
      break;
    }
    case 'retire': {
      emit('retire', item);
      break;
    }
    case 'reveal': {
      emit('reveal', item);
      break;
    }
    case 'status': {
      emit('status', item);
      break;
    }
  }
}
</script>

<template>
  <Drawer class="w-full max-w-180" :footer="false" title="凭证详情">
    <template v-if="credential">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div class="text-lg font-semibold">{{ credential.name }}</div>
          <div class="text-sm text-gray-500">{{ credential.code }}</div>
        </div>
        <Tag :color="stateColor">{{ stateLabel(credential.state) }}</Tag>
      </div>
      <Tabs :active-key="activeTab" @change="handleTabChange">
        <TabPane key="overview" tab="概览">
          <Descriptions bordered :column="1" size="small">
            <DescriptionsItem label="类型">
              {{ kindLabel(credential.kind) }}
            </DescriptionsItem>
            <DescriptionsItem label="用途">
              {{ profileLabel(profiles, credential.kind, credential.profile) }}
            </DescriptionsItem>
            <DescriptionsItem label="字段摘要">
              {{ summaryText(credential) }}
            </DescriptionsItem>
            <DescriptionsItem label="使用状态">
              <Tag
                :color="
                  Number(credential.failed_binding_count) > 0
                    ? 'error'
                    : Number(credential.binding_count) === 0
                      ? 'default'
                      : Number(credential.last_used_at) > 0
                        ? 'success'
                        : 'warning'
                "
              >
                {{
                  Number(credential.failed_binding_count) > 0
                    ? `${credential.failed_binding_count} 个使用失败`
                    : Number(credential.binding_count) === 0
                      ? '未绑定'
                      : Number(credential.last_used_at) > 0
                        ? '最近可用'
                        : '尚未使用'
                }}
              </Tag>
            </DescriptionsItem>
            <DescriptionsItem label="绑定数量">
              {{ credential.binding_count }} 个业务对象
            </DescriptionsItem>
            <DescriptionsItem label="创建人">
              #{{ credential.created_by }}
            </DescriptionsItem>
            <DescriptionsItem label="有效期">
              <Tag :color="expiryInfo(credential.expires_at).color">
                {{ expiryInfo(credential.expires_at).label }}
              </Tag>
              {{ Times.formatOptionalUnix(credential.expires_at) }}
            </DescriptionsItem>
            <DescriptionsItem label="最近使用">
              {{ Times.formatOptionalUnix(credential.last_used_at) }}
            </DescriptionsItem>
            <DescriptionsItem v-if="credential.last_error" label="最近错误">
              <span class="whitespace-pre-wrap text-red-600">
                {{ credential.last_error }}
              </span>
            </DescriptionsItem>
            <DescriptionsItem label="最近更新">
              {{ Times.formatOptionalUnix(credential.updated_at) }}
            </DescriptionsItem>
            <DescriptionsItem label="备注">
              {{ credential.remark || '无' }}
            </DescriptionsItem>
          </Descriptions>
          <Space class="mt-4" wrap>
            <Button
              v-if="hasAccessByCodes(['credential:update'])"
              @click="closeAndEmit('edit')"
            >
              编辑信息
            </Button>
            <Button
              v-if="hasAccessByCodes(['credential:replace'])"
              @click="closeAndEmit('replace')"
            >
              更换类型与材料
            </Button>
            <Button danger @click="closeAndEmit('reveal')"> 查看明文 </Button>
            <Button
              v-if="
                credential.state !== 'retired' &&
                hasAccessByCodes(['credential:status'])
              "
              @click="closeAndEmit('status')"
            >
              {{ credential.state === 'active' ? '禁用' : '启用' }}
            </Button>
            <Button
              v-if="
                credential.state !== 'retired' &&
                hasAccessByCodes(['credential:retire'])
              "
              danger
              @click="closeAndEmit('retire')"
            >
              退役
            </Button>
          </Space>
        </TabPane>
        <TabPane
          :tab="`使用位置（${credential.binding_count}）`"
          key="bindings"
        >
          <div class="mb-3 flex items-center justify-between gap-2">
            <span class="text-sm text-gray-500">
              共绑定 {{ credential.binding_count }} 个业务对象
            </span>
            <Segmented
              v-model:value="bindingFilter"
              :options="[
                { label: '全部', value: 'all' },
                { label: '有错误', value: 'error' },
                { label: '未使用', value: 'unused' },
              ]"
              size="small"
            />
          </div>
          <Table
            v-if="bindings.length > 0 || bindingsLoading"
            :columns="bindingColumns"
            :data-source="filteredBindings"
            :loading="bindingsLoading"
            row-key="id"
            size="small"
            :pagination="false"
            :scroll="{ x: 900 }"
          >
            <template #bodyCell="{ column, record }">
              <span v-if="column.dataIndex === 'last_used_at'">
                {{ Times.formatOptionalUnix(record.last_used_at) }}
              </span>
              <details v-else-if="column.dataIndex === 'last_error'">
                <summary class="cursor-pointer text-red-600">
                  {{ record.last_error ? '查看错误' : '无' }}
                </summary>
                <p class="mt-1 whitespace-pre-wrap text-xs text-red-600">
                  {{ record.last_error || '无' }}
                </p>
              </details>
            </template>
          </Table>
          <Empty
            v-else
            description="当前没有业务使用此凭证，替换不会影响现有消费者。"
          />
        </TabPane>
      </Tabs>
    </template>
  </Drawer>
</template>
