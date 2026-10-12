<script setup lang="ts">
import type { Dayjs } from 'dayjs';

import type { DownloadUserTreeNode } from '#/api/res/downloads';
import type {
  GrantFilter,
  GrantResource,
  GrantRow,
  GrantValues,
} from '#/api/res/grant-maintenance';

import { computed, onMounted, reactive, ref, watch } from 'vue';

import { useAccess } from '@vben/access';

import {
  Alert,
  Button,
  DatePicker,
  Form,
  FormItem,
  Input,
  message,
  Pagination,
  Popconfirm,
  Select,
  Switch,
  Table,
  Tag,
} from 'antdv-next';
import dayjs from 'dayjs';

import { grantApi, grantModules } from '#/api/res/grant-maintenance';
import UserTreeSelect from '#/components/user-tree-select';
import { requestErrorMessage } from '#/request-errors';

import BatchGrant from './batch-grant.vue';
import GrantEditor from './grant-editor.vue';
const props = defineProps<{
  delivery?: boolean;
  fixedResource?: GrantResource;
  fixedVersion?: number;
}>();
const { hasAccessByCodes } = useAccess();
const api = computed(() => grantApi(!!props.delivery));
const code = computed(() =>
  props.delivery
    ? 'api:res.delivery.grants.maintenance.'
    : 'api:res.admin.res.grants.maintenance.',
);
const canCreate = computed(() => hasAccessByCodes([`${code.value}create`]));
const canEdit = computed(() => hasAccessByCodes([`${code.value}change`]));
const canDelete = computed(() => hasAccessByCodes([`${code.value}remove`]));
const filters = reactive<GrantFilter>({
  keyword: '',
  uids: [],
  page: 1,
  size: 20,
});
const rows = ref<GrantRow[]>([]);
const total = ref(0);
const loading = ref(false);
const busy = ref(false);
const errorText = ref('');
const tree = ref<DownloadUserTreeNode[]>([]);
const treeLoading = ref(false);
const treeError = ref('');
const advanced = ref(false);
const selected = ref<GrantRow[]>([]);
const editorOpen = ref(false);
const targets = ref<GrantRow[]>([]);
const batchOpen = ref(false);
const batchRevoke = ref(false);
let generation = 0;
const actorOptions = computed(() => {
  const flatten = (
    nodes: DownloadUserTreeNode[],
  ): { value: number; label: string }[] =>
    nodes.flatMap((n) => [
      ...(n.selectable ? [{ value: Number(n.value), label: n.title }] : []),
      ...flatten(n.children),
    ]);
  const options = flatten(tree.value);
  for (const row of rows.value)
    if (
      Number(row.granted_by) > 0 &&
      !options.some((o) => o.value === Number(row.granted_by))
    )
      options.push({
        value: Number(row.granted_by),
        label: row.granted_by_name || `用户 ${row.granted_by}`,
      });
  return options;
});
const selectedKeys = computed(() => selected.value.map((r) => String(r.id)));
function selectRows(keys: (number | string)[]) {
  const all = new Map(
    [...selected.value, ...rows.value].map((r) => [String(r.id), r]),
  );
  selected.value = keys.flatMap((key) => {
    const r = all.get(String(key));
    return r ? [r] : [];
  });
}
const columns = computed(() => [
  { title: '作品 / 编码', key: 'resource', width: 220, fixed: 'left' as const },
  { title: '被授权人', key: 'user', width: 170 },
  ...(props.delivery
    ? [{ title: '交付版本 / 材料', key: 'modules', width: 230 }]
    : []),
  { title: '集数范围', key: 'seq', width: 130 },
  { title: '生效时间', key: 'valid_from', width: 215 },
  { title: '失效时间', key: 'valid_until', width: 215 },
  { title: '允许下载', key: 'enabled', width: 110 },
  { title: '生效状态', key: 'status', width: 110 },
  { title: '最近授权人 / 时间', key: 'actor', width: 190 },
  { title: '操作', key: 'action', width: 135, fixed: 'right' as const },
]);
function state(row: GrantRow) {
  const now = dayjs().unix();
  if (!row.can_download) return { label: '已停用', color: 'default' };
  if (Number(row.valid_until) > 0 && Number(row.valid_until) <= now)
    return { label: '已失效', color: 'red' };
  if (Number(row.valid_from) > now) return { label: '待生效', color: 'orange' };
  return { label: '生效中', color: 'green' };
}
const date = (value: number) =>
  Number(value) > 0 ? dayjs.unix(Number(value)) : null;
function timeFilter(
  field: 'end' | 'start' | 'updated',
  value: Dayjs[] | null | undefined,
) {
  const fields = {
    updated: ['updated_from', 'updated_until'],
    start: ['valid_from_min', 'valid_from_max'],
    end: ['valid_until_min', 'valid_until_max'],
  } as const;
  const [from, until] = fields[field];
  filters[from] = value?.[0]?.unix();
  filters[until] = value?.[1]?.unix();
}
const ranges = reactive<{
  updated?: [Dayjs, Dayjs];
  start?: [Dayjs, Dayjs];
  end?: [Dayjs, Dayjs];
}>({});
async function load(reset = false) {
  if (reset) {
    filters.page = 1;
    selected.value = [];
  }
  const ticket = ++generation;
  loading.value = true;
  errorText.value = '';
  try {
    const result = await api.value.page({
      ...filters,
      res_id: props.fixedResource?.res_id ?? filters.res_id,
    });
    if (ticket !== generation) return;
    rows.value = result.items;
    total.value = Number(result.total);
  } catch (error) {
    if (ticket === generation)
      errorText.value = requestErrorMessage(error, '读取授权失败');
  } finally {
    if (ticket === generation) loading.value = false;
  }
}
async function loadTree() {
  treeLoading.value = true;
  treeError.value = '';
  try {
    tree.value = await api.value.users();
  } catch (error) {
    treeError.value = requestErrorMessage(error, '读取用户组织树失败');
  } finally {
    treeLoading.value = false;
  }
}
function edit(records: GrantRow[] = []) {
  targets.value = records;
  editorOpen.value = true;
}
async function patch(records: GrantRow[], values: Partial<GrantValues>) {
  if (busy.value || records.length === 0) return;
  busy.value = true;
  errorText.value = '';
  try {
    const count = await api.value.change(records, values);
    message.success(`已更新 ${count} 条授权`);
    selected.value = [];
    await load();
  } catch (error) {
    errorText.value = requestErrorMessage(error, '更新失败，请刷新后重试');
  } finally {
    busy.value = false;
  }
}
async function remove(records: GrantRow[]) {
  if (busy.value || records.length === 0) return;
  busy.value = true;
  errorText.value = '';
  try {
    const count = await api.value.remove(records);
    message.success(`已删除 ${count} 条授权`);
    selected.value = [];
    await load();
  } catch (error) {
    errorText.value = requestErrorMessage(error, '删除授权失败');
  } finally {
    busy.value = false;
  }
}
function saved() {
  message.success('授权已保存');
  selected.value = [];
  void load();
}
function reset() {
  Object.keys(filters).forEach((key) => Reflect.deleteProperty(filters, key));
  Object.assign(filters, { keyword: '', uids: [], page: 1, size: 20 });
  ranges.updated = ranges.start = ranges.end = undefined;
  void load(true);
}
watch(
  () => props.fixedResource?.res_id,
  () => load(true),
);
onMounted(() => {
  void load();
  void loadTree();
});
</script>
<template>
  <section>
    <Alert
      v-if="delivery"
      type="info"
      message="交付授权绑定具体版本和材料模块。时间和开关可直接在行内修改；批量编辑保留未勾选的字段，不会更换版本。"
      class="mb-4"
    />
    <Form layout="vertical" class="rounded border p-4">
      <div class="grid gap-x-4 md:grid-cols-2 xl:grid-cols-4">
        <FormItem v-if="!fixedResource" label="作品名称 / 编码">
          <Input
            v-model:value="filters.keyword"
            allow-clear
            placeholder="输入名称或作品编码"
            @press-enter="load(true)"
          />
        </FormItem>
        <FormItem label="被授权用户">
          <UserTreeSelect
            v-model:value="filters.uids!"
            allow-disabled
            :tree-data="tree"
            :loading="treeLoading"
            :error="treeError"
            @retry="loadTree"
          />
        </FormItem>
        <FormItem label="生效状态">
          <Select
            v-model:value="filters.status"
            allow-clear
            placeholder="全部状态"
            :options="[
              { value: 'active', label: '生效中' },
              { value: 'scheduled', label: '待生效' },
              { value: 'expired', label: '已失效' },
              { value: 'disabled', label: '已停用' },
            ]"
          />
        </FormItem>
        <FormItem v-if="delivery" label="材料模块">
          <Select
            v-model:value="filters.module"
            allow-clear
            placeholder="全部模块"
            :options="grantModules"
          />
        </FormItem>
        <template v-if="advanced">
          <FormItem label="最近授权人">
            <Select
              v-model:value="filters.granted_by"
              show-search
              allow-clear
              option-filter-prop="label"
              :options="actorOptions"
              placeholder="姓名或用户编号"
            />
          </FormItem>
          <FormItem label="授权开关">
            <Select
              :value="
                filters.can_download === undefined
                  ? undefined
                  : filters.can_download
                    ? 1
                    : 0
              "
              @change="
                (value) =>
                  (filters.can_download =
                    value === undefined ? undefined : value === 1)
              "
              allow-clear
              :options="[
                { value: 1, label: '启用' },
                { value: 0, label: '停用' },
              ]"
              placeholder="全部"
            />
          </FormItem>
          <FormItem v-if="delivery" label="交付版本">
            <Input
              v-model:value="filters.version_keyword"
              allow-clear
              placeholder="按版本名称搜索"
            />
          </FormItem>
          <FormItem
            v-for="range in [
              ['updated', '授权更新时间'],
              ['start', '生效时间'],
              ['end', '失效时间'],
            ] as const"
            :key="range[0]"
            :label="range[1]"
          >
            <DatePicker.RangePicker
              v-model:value="ranges[range[0]]"
              show-time
              allow-clear
              @change="(value) => timeFilter(range[0], value)"
            />
          </FormItem>
        </template>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button type="primary" :loading="loading" @click="load(true)">
          查询
        </Button>
        <Button @click="reset">重置</Button>
        <Button type="link" @click="advanced = !advanced">
          {{ advanced ? '收起筛选' : '更多筛选' }}
        </Button>
      </div>
    </Form>
    <Alert v-if="errorText" :message="errorText" type="error" class="mt-4" />
    <div class="my-4 flex flex-wrap items-center gap-2">
      <Button v-if="canCreate" type="primary" :disabled="busy" @click="edit()">
        新增 / 批量授权
      </Button>
      <Button
        v-if="canEdit"
        :disabled="!selected.length || busy || selected.length > 200"
        @click="edit(selected)"
      >
        批量修改
      </Button>
      <Popconfirm
        v-if="canEdit"
        :title="`确认启用选中的 ${selected.length} 条授权？有效期和下载范围保持不变。`"
        @confirm="patch(selected, { can_download: true })"
      >
        <Button :disabled="!selected.length || busy || selected.length > 200">
          批量启用
        </Button>
      </Popconfirm>
      <Button
        v-if="canEdit"
        :disabled="!selected.length || busy || selected.length > 200"
        @click="patch(selected, { can_download: false })"
      >
        批量停用
      </Button>
      <Popconfirm
        v-if="canDelete"
        :title="`确认删除选中的 ${selected.length} 条授权？`"
        @confirm="remove(selected)"
      >
        <Button
          danger
          :disabled="!selected.length || busy || selected.length > 200"
        >
          批量删除
        </Button>
      </Popconfirm>
      <template
        v-if="
          !delivery &&
          hasAccessByCodes([
            'api:res.admin.res.download_permissions.batch.save',
          ])
        "
      >
        <Button
          @click="
            batchRevoke = false;
            batchOpen = true;
          "
        >
          按剧名 / 编码批量授权
        </Button>
        <Button
          @click="
            batchRevoke = true;
            batchOpen = true;
          "
        >
          按剧名 / 编码取消授权
        </Button>
      </template>
      <span class="text-muted-foreground">
        已选 {{ selected.length }} 条（可跨页，最多200条）
      </span>
      <Button v-if="selected.length" type="link" @click="selected = []">
        清空选择
      </Button>
    </div>
    <Table
      :data-source="rows"
      :columns="columns"
      :row-key="(r: GrantRow) => String(r.id)"
      :pagination="false"
      :loading="loading || busy"
      :scroll="{ x: 1800 }"
      :row-selection="{
        selectedRowKeys: selectedKeys,
        preserveSelectedRowKeys: true,
        onChange: selectRows,
      }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'resource'">
          <strong>{{ record.res_name }}</strong>
          <div class="text-muted-foreground text-xs">
            {{ record.resource_code }}
          </div>
        </template>
        <template v-else-if="column.key === 'user'">
          {{ record.user_name || '姓名不可用' }}
          <div class="text-muted-foreground text-xs">用户 {{ record.uid }}</div>
        </template>
        <template v-else-if="column.key === 'modules'">
          {{ record.version_name || '未绑定有效版本' }}
          <div class="text-muted-foreground text-xs">
            {{
              record.modules
                .map(
                  (m: string) =>
                    grantModules.find((v) => v.value === m)?.label || m,
                )
                .join('、') || '无模块授权'
            }}
          </div>
        </template>
        <span v-else-if="column.key === 'seq'">
          {{ record.seq_from || 1 }} — {{ record.seq_until || '全部' }}
        </span>
        <template
          v-else-if="
            column.key === 'valid_from' || column.key === 'valid_until'
          "
        >
          <DatePicker
            v-if="canEdit"
            :value="date(record[column.key])"
            show-time
            allow-clear
            :disabled="busy"
            :placeholder="column.key === 'valid_from' ? '立即生效' : '永久有效'"
            @change="
              (value) =>
                patch([record], {
                  [String(column.key)]:
                    (Array.isArray(value) ? value[0] : value)?.unix() ?? 0,
                })
            "
          />
          <span v-else>
            {{
              date(record[column.key])?.format('YYYY-MM-DD HH:mm:ss') ||
              (column.key === 'valid_from' ? '立即生效' : '永久有效')
            }}
          </span>
        </template>
        <Switch
          v-else-if="column.key === 'enabled'"
          :checked="record.can_download"
          :disabled="!canEdit || busy"
          @change="(value) => patch([record], { can_download: !!value })"
        />
        <Tag v-else-if="column.key === 'status'" :color="state(record).color">
          {{ state(record).label }}
        </Tag>
        <template v-else-if="column.key === 'actor'">
          {{ record.granted_by_name || `用户 ${record.granted_by}` }}
          <div class="text-muted-foreground text-xs">
            {{ date(record.updated_at)?.format('YYYY-MM-DD HH:mm:ss') }}
          </div>
        </template>
        <template v-else-if="column.key === 'action'">
          <Button
            v-if="canEdit"
            type="link"
            :disabled="busy"
            @click="edit([record])"
          >
            编辑
          </Button>
          <Popconfirm
            v-if="canDelete"
            title="确认删除这条授权？"
            @confirm="remove([record])"
          >
            <Button type="link" danger :disabled="busy">删除</Button>
          </Popconfirm>
        </template>
      </template>
    </Table>
    <Pagination
      v-model:current="filters.page"
      v-model:page-size="filters.size"
      :total="total"
      :page-size-options="[20, 50, 100]"
      :show-total="(count) => `共 ${count} 条授权`"
      show-size-changer
      class="mt-4"
      @change="load()"
    />
    <GrantEditor
      v-model:open="editorOpen"
      :delivery="!!delivery"
      :targets="targets"
      :tree="tree"
      :tree-loading="treeLoading"
      :tree-error="treeError"
      :fixed-resource="fixedResource"
      :fixed-version="fixedVersion"
      @retry="loadTree"
      @saved="saved"
    />
    <BatchGrant
      v-if="!delivery"
      v-model:open="batchOpen"
      :revoke="batchRevoke"
      :initial-uids="filters.uids || []"
      :user-tree="tree"
      :user-tree-loading="treeLoading"
      :user-tree-error="treeError"
      @retry="loadTree"
      @saved="saved"
    />
  </section>
</template>
