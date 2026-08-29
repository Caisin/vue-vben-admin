<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  DeveloperAccountOption,
  TikTokAccountListItem,
  TikTokUser,
} from '#/api/developer-account';

import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';
import {
  ArrowUp,
  CircleX,
  Copy,
  RotateCw,
  Search,
  Settings,
} from '@vben/icons';

import {
  Avatar,
  Button,
  Card,
  Descriptions,
  DescriptionsItem,
  Form,
  FormItem,
  Input,
  message,
  Modal,
  Space,
  Tag,
  TreeSelect,
} from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { DeveloperAccountApi } from '#/api/developer-account';
import { TaskRunApi } from '#/api/task';

const username = ref('');
const loading = ref(false);
const user = ref<TikTokUser>();
const saving = ref(false);
const country = ref('');
const developerAccountId = ref<number>();
const developerAccounts = ref<DeveloperAccountOption[]>([]);
const batchImportOpen = ref(false);
const batchImporting = ref(false);
const batchImportText = ref('');
const batchImportCountry = ref('美区');
const batchFileInput = ref<HTMLInputElement>();
const linkModalOpen = ref(false);
const linking = ref(false);
const linkingRow = ref<TikTokAccountListItem>();
const linkedDeveloperAccountId = ref<number>();
const linkedCountry = ref('');
const activeTaskId = ref<number | string>();
const reindexingSearch = ref(false);
let taskPollTimer: number | undefined;

function buildDeveloperAccountTree(currentTiktokAccountId?: string) {
  return [
    { label: 'Apple', platform: 'apple' },
    { label: 'Google', platform: 'google' },
  ]
    .map((group) => ({
      label: group.label,
      selectable: false,
      value: `platform:${group.platform}`,
      options: developerAccounts.value
        .filter((item) => item.platform === group.platform)
        .map((item) => {
          const occupied =
            item.tiktok_account_id !== null &&
            item.tiktok_account_id !== undefined &&
            item.tiktok_account_id !== currentTiktokAccountId;
          return {
            disabled: occupied,
            label: `${item.account} · ${item.subject_name_cn || '未填写主体'}${occupied ? ' · 已关联' : ''}`,
            value: item.id,
          };
        }),
    }))
    .filter((group) => group.options.length > 0)
    .map(({ options, ...group }) => ({ ...group, children: options }));
}

const developerAccountTreeData = computed(() => buildDeveloperAccountTree());
const linkedDeveloperAccountTreeData = computed(() =>
  buildDeveloperAccountTree(linkingRow.value?.id),
);

const linkFilterSchema: VbenFormSchema[] = [
  {
    component: 'Input',
    componentProps: {
      allowClear: true,
      placeholder: '用户 ID、用户名、昵称、地区或简介',
    },
    fieldName: 'keyword',
    label: '全文关键字',
  },
  {
    component: 'Select',
    componentProps: {
      allowClear: true,
      options: [
        { label: '已关联', value: true },
        { label: '未关联', value: false },
      ],
    },
    fieldName: 'linked',
    label: '关联状态',
  },
];

const [Grid, gridApi] = useVbenVxeGrid<TikTokAccountListItem>({
  formOptions: { schema: linkFilterSchema, submitOnChange: true },
  gridOptions: {
    columns: [
      { field: 'unique_id', title: '用户名', minWidth: 160 },
      { field: 'user_id', title: '用户 ID', minWidth: 180 },
      { field: 'nickname', title: '昵称', minWidth: 140 },
      { field: 'country', title: '账号地区', minWidth: 110 },
      {
        field: 'registered_via',
        title: '注册平台',
        minWidth: 100,
        slots: { default: 'registeredVia' },
      },
      {
        field: 'registered_account',
        title: '关联开发者账户',
        minWidth: 180,
        slots: { default: 'registeredAccount' },
      },
      { field: 'follower_count', title: '粉丝', width: 100 },
      { field: 'video_count', title: '视频', width: 90 },
      {
        field: 'operation',
        title: '操作',
        fixed: 'right',
        width: 150,
        slots: { default: 'operation' },
      },
    ],
    height: 360,
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50] },
    proxyConfig: {
      ajax: {
        query: async ({ page }, values) =>
          DeveloperAccountApi.tiktokAccounts({
            keyword:
              typeof values.keyword === 'string'
                ? values.keyword.trim() || undefined
                : undefined,
            linked:
              typeof values.linked === 'boolean' ? values.linked : undefined,
            page: page.currentPage,
            size: page.pageSize,
          }),
      },
    },
    rowConfig: { keyField: 'id' },
    toolbarConfig: {
      custom: true,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<TikTokAccountListItem>,
});

const profileUrl = computed(() =>
  user.value ? `https://www.tiktok.com/@${user.value.unique_id}` : '',
);

const batchImportResult = computed(() =>
  parseImportItems(batchImportText.value, batchImportCountry.value),
);

async function query() {
  const value = username.value.trim();
  if (!value) {
    message.warning('请输入 TikTok 用户名');
    return;
  }
  loading.value = true;
  try {
    user.value = await DeveloperAccountApi.tiktokUser(value);
  } finally {
    loading.value = false;
  }
}

async function reindexSearch() {
  reindexingSearch.value = true;
  try {
    const result = await DeveloperAccountApi.reindexSearch();
    message.success(`账户搜索索引已重建，共 ${result.indexed} 条`);
    await gridApi.query();
  } finally {
    reindexingSearch.value = false;
  }
}

async function saveAccount() {
  if (!user.value) {
    message.warning('请先查询 TikTok 用户');
    return;
  }
  const accountCountry = country.value.trim();
  if (!accountCountry) {
    message.warning('请填写账号地区');
    return;
  }
  saving.value = true;
  try {
    await DeveloperAccountApi.createTiktokAccount({
      country: accountCountry,
      developer_account_id: developerAccountId.value,
      username: user.value.unique_id,
    });
    message.success('TT 账户已保存');
    await gridApi.query();
  } finally {
    saving.value = false;
  }
}

function normalizeUsername(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^(username|user_name|user_id|unique_id|uid|用户名|账号)$/i.test(trimmed))
    return '';
  const urlMatch = trimmed.match(/@([A-Za-z0-9._]+)(?:[/?#\s]|$)/);
  if (urlMatch?.[1]) return urlMatch[1];
  const firstCell = trimmed.split(/[\t,，;；]/)[0]?.trim() ?? '';
  return firstCell.replace(/^@+/, '');
}

function parseImportItems(text: string, defaultCountry: string) {
  const items: Array<{ country: string; username: string }> = [];
  const usernames = new Set<string>();
  let duplicateRows = 0;
  let invalidRows = 0;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const columns = line.includes('\t')
      ? line.split('\t')
      : line.split(/[,，]/);
    const [first = '', second] = columns.map((value) => value.trim());
    if (
      second === undefined &&
      /^(username|user_name|用户名|账号)$/i.test(first)
    ) {
      continue;
    }
    if (
      /^(地区|国家|country)$/i.test(first) &&
      second !== undefined &&
      /^(username|user_name|用户名|账号)$/i.test(second)
    ) {
      continue;
    }
    const country = second === undefined ? defaultCountry.trim() : first;
    const username = normalizeUsername(second === undefined ? first : second);
    const effectiveCountry = country || defaultCountry.trim();
    if (!username || !effectiveCountry || columns.length > 2) {
      invalidRows += 1;
      continue;
    }
    if (usernames.has(username)) {
      duplicateRows += 1;
      continue;
    }
    usernames.add(username);
    items.push({ country: effectiveCountry, username });
  }
  return { duplicateRows, invalidRows, items };
}

function openBatchImport() {
  batchImportOpen.value = true;
  batchImportText.value = '';
  batchImportCountry.value = '美区';
}

async function importBatchFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  batchImportText.value = await file.text();
  message.success(`已读取 ${batchImportResult.value.items.length} 个账户`);
}

function clearTaskPoll() {
  if (taskPollTimer) {
    window.clearInterval(taskPollTimer);
    taskPollTimer = undefined;
  }
}

async function refreshTask() {
  const taskId = activeTaskId.value;
  if (!taskId) return;
  try {
    const task = await TaskRunApi.detail(taskId);
    if (['queued', 'retrying', 'running'].includes(task.status)) return;
    clearTaskPoll();
    activeTaskId.value = undefined;
    if (task.status === 'succeeded' || task.status === 'partially_succeeded') {
      message.success(task.message || `任务 #${task.id} 已完成`);
      await gridApi.query();
    } else {
      message.error(
        task.error_message || task.message || `任务 #${task.id} 未完成`,
      );
    }
  } catch {
    clearTaskPoll();
    activeTaskId.value = undefined;
    message.error(`无法查询任务 #${taskId} 的状态`);
  }
}

function pollTask(taskId: number | string) {
  clearTaskPoll();
  activeTaskId.value = taskId;
  void refreshTask();
  taskPollTimer = window.setInterval(() => {
    void refreshTask();
  }, 3000);
}

async function importBatchAccounts() {
  const result = batchImportResult.value;
  if (result.items.length === 0) {
    message.warning('请先输入或导入 TT 账户');
    return;
  }
  if (result.invalidRows > 0) {
    message.warning(
      `有 ${result.invalidRows} 行缺少地区或用户名，请修正后提交`,
    );
    return;
  }
  batchImporting.value = true;
  try {
    const task = await DeveloperAccountApi.importTiktokAccounts({
      country: batchImportCountry.value.trim(),
      items: result.items,
    });
    batchImportOpen.value = false;
    message.success(`批量导入任务已提交：#${task.id}`);
    pollTask(task.id);
  } finally {
    batchImporting.value = false;
  }
}

function openLink(row: TikTokAccountListItem) {
  linkingRow.value = row;
  linkedDeveloperAccountId.value = row.developer_account_id ?? undefined;
  linkedCountry.value = row.country;
  linkModalOpen.value = true;
}

async function saveLink() {
  if (!linkingRow.value) return;
  const accountCountry = linkedCountry.value.trim();
  if (!accountCountry) {
    message.warning('请填写账号地区');
    return;
  }
  linking.value = true;
  try {
    await DeveloperAccountApi.updateTiktokAccountLink(linkingRow.value.id, {
      country: accountCountry,
      developer_account_id: linkedDeveloperAccountId.value,
    });
    message.success('TT 账户信息已更新');
    linkModalOpen.value = false;
    await gridApi.query();
  } finally {
    linking.value = false;
  }
}

function removeAccount(row: TikTokAccountListItem) {
  // 删除只移除关联档案，不影响 TikTok 平台账户。
  Modal.confirm({
    title: '删除 TT 账户档案',
    content: `@${row.unique_id}`,
    okButtonProps: { danger: true },
    onOk: async () => {
      await DeveloperAccountApi.deleteTiktokAccount(row.id);
      message.success('TT 账户档案已删除');
      await gridApi.query();
    },
  });
}

onMounted(async () => {
  developerAccounts.value = await DeveloperAccountApi.tiktokAccountOptions();
});

async function copyValue(label: string, value: string) {
  if (!value) return;
  await navigator.clipboard.writeText(value);
  message.success(`${label}已复制`);
}

onBeforeUnmount(() => {
  clearTaskPoll();
});
</script>

<template>
  <Page auto-content-height class="management-page">
    <Card title="TikTok 用户查询">
      <div class="flex w-full flex-wrap items-center justify-between gap-3">
        <div class="flex min-w-0 max-w-160 flex-1">
          <Input
            v-model:value="username"
            allow-clear
            class="min-w-0 flex-1"
            placeholder="输入用户名，例如 @cs.yanbao"
            @press-enter="query"
          />
          <Button type="primary" :loading="loading" @click="query">
            <Search class="size-4" />查询
          </Button>
        </div>
        <Button
          v-access:code="'developer-account:tiktok-account-create'"
          :loading="Boolean(activeTaskId)"
          @click="openBatchImport"
        >
          <ArrowUp class="size-4" />批量导入
        </Button>
      </div>

      <div v-if="user" class="mt-6 max-w-240">
        <div class="mb-4 flex items-center gap-4">
          <Avatar :src="user.avatar_url" :size="64" />
          <div>
            <div class="text-lg font-medium">{{ user.nickname }}</div>
            <div class="text-muted-foreground">@{{ user.unique_id }}</div>
          </div>
          <Tag v-if="user.verified" color="blue">已认证</Tag>
        </div>
        <Descriptions bordered :column="2" size="small">
          <DescriptionsItem label="用户 ID">
            <Space>
              <span>{{ user.id }}</span>
              <Button
                size="small"
                type="text"
                @click="copyValue('用户 ID', user.id)"
              >
                <Copy class="size-4" />
              </Button>
            </Space>
          </DescriptionsItem>
          <DescriptionsItem label="唯一用户名">
            <Space>
              <span>{{ user.unique_id }}</span>
              <Button
                size="small"
                type="text"
                @click="copyValue('唯一用户名', user.unique_id)"
              >
                <Copy class="size-4" />
              </Button>
            </Space>
          </DescriptionsItem>
          <DescriptionsItem label="主页地址" :span="2">
            <Space>
              <a :href="profileUrl" target="_blank">{{ profileUrl }}</a>
              <Button
                size="small"
                type="text"
                @click="copyValue('主页地址', profileUrl)"
              >
                <Copy class="size-4" />
              </Button>
            </Space>
          </DescriptionsItem>
          <DescriptionsItem label="secUid" :span="2">
            <Space>
              <span class="break-all">{{ user.sec_uid || '-' }}</span>
              <Button
                v-if="user.sec_uid"
                size="small"
                type="text"
                @click="copyValue('secUid', user.sec_uid)"
              >
                <Copy class="size-4" />
              </Button>
            </Space>
          </DescriptionsItem>
          <DescriptionsItem label="简介" :span="2">
            {{ user.signature || '-' }}
          </DescriptionsItem>
          <DescriptionsItem label="粉丝">
            {{ user.follower_count }}
          </DescriptionsItem>
          <DescriptionsItem label="关注">
            {{ user.following_count }}
          </DescriptionsItem>
          <DescriptionsItem label="获赞">
            {{ user.heart_count }}
          </DescriptionsItem>
          <DescriptionsItem label="视频">
            {{ user.video_count }}
          </DescriptionsItem>
        </Descriptions>
        <div class="mt-4 flex flex-wrap items-center gap-3">
          <Input
            v-model:value="country"
            class="w-48"
            :maxlength="64"
            placeholder="账号地区，例如：美区"
          />
          <TreeSelect
            v-model:value="developerAccountId"
            allow-clear
            class="w-100"
            placeholder="可选：关联 Apple / Google 开发者账户"
            :tree-data="developerAccountTreeData"
            tree-default-expand-all
            tree-node-filter-prop="label"
            show-search
          />
          <Button
            v-access:code="'developer-account:tiktok-account-create'"
            type="primary"
            :loading="saving"
            @click="saveAccount"
          >
            保存账户
          </Button>
        </div>
      </div>

      <div class="mt-8">
        <Grid table-title="已保存的 TT 账户">
          <template #toolbar-tools>
            <Button
              v-access:code="'developer-account:search-reindex'"
              :loading="reindexingSearch"
              @click="reindexSearch"
            >
              <RotateCw class="size-4" />重建搜索索引
            </Button>
          </template>
          <template #registeredVia="{ row }">
            <Tag v-if="row.registered_via" color="blue">
              {{ row.registered_via === 'apple' ? 'Apple' : 'Google' }}
            </Tag>
            <Tag v-else>未关联</Tag>
          </template>
          <template #registeredAccount="{ row }">
            {{ row.registered_account || '未关联' }}
          </template>
          <template #operation="{ row }">
            <Button
              v-access:code="'developer-account:tiktok-account-update'"
              size="small"
              type="text"
              title="维护账户信息"
              @click="openLink(row)"
            >
              <Settings class="size-4" />
            </Button>
            <Button
              v-access:code="'developer-account:tiktok-account-delete'"
              size="small"
              type="text"
              title="删除"
              @click="removeAccount(row)"
            >
              <CircleX class="size-4" />
            </Button>
          </template>
        </Grid>
      </div>
    </Card>

    <Modal
      v-model:open="linkModalOpen"
      title="维护 TT 账户"
      :confirm-loading="linking"
      @ok="saveLink"
    >
      <Form layout="vertical">
        <FormItem label="默认账号地区" required>
          <Input v-model:value="linkedCountry" :maxlength="64" />
        </FormItem>
        <FormItem label="关联开发者账户">
          <TreeSelect
            v-model:value="linkedDeveloperAccountId"
            allow-clear
            class="w-full"
            placeholder="选择 Apple / Google 开发者账户"
            :tree-data="linkedDeveloperAccountTreeData"
            tree-default-expand-all
            tree-node-filter-prop="label"
            show-search
          />
        </FormItem>
      </Form>
    </Modal>

    <Modal
      v-model:open="batchImportOpen"
      :confirm-loading="batchImporting"
      title="批量导入 TT 账户"
      width="720px"
      @ok="importBatchAccounts"
    >
      <Form layout="vertical">
        <FormItem label="账号地区" required>
          <Input
            v-model:value="batchImportCountry"
            :maxlength="64"
            placeholder="未填写地区的行使用此值"
          />
        </FormItem>
        <FormItem
          :extra="`已识别 ${batchImportResult.items.length} 个账户；重复 ${batchImportResult.duplicateRows} 行，无效 ${batchImportResult.invalidRows} 行`"
          label="地区、TT 用户名"
          required
        >
          <Input.TextArea
            v-model:value="batchImportText"
            :rows="10"
            placeholder="每行：地区,用户名；也可只填用户名并使用默认地区"
          />
        </FormItem>
        <div class="flex items-center gap-3">
          <input
            ref="batchFileInput"
            accept=".txt,.csv,.tsv,text/plain,text/csv,text/tab-separated-values"
            class="hidden"
            type="file"
            @change="importBatchFile"
          />
          <Button @click="batchFileInput?.click()">
            <ArrowUp class="size-4" />上传文件
          </Button>
          <span class="text-muted-foreground">
            支持“地区,用户名”或单列用户名，首行表头可省略
          </span>
        </div>
      </Form>
    </Modal>
  </Page>
</template>
