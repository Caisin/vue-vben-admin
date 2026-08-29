<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type {
  VxeTableGridColumns,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';

import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import {
  Button,
  Form,
  FormItem,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Tag,
  TextArea,
} from 'antdv-next';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import { ditch } from '#/api/res/seas';

type PageKind = 'channel' | 'set-channel' | 'team' | 'user';
type FieldKind = 'number' | 'select' | 'text' | 'textarea';
type Field = {
  hidden?: boolean;
  key: string;
  kind?: FieldKind;
  label: string;
  options?: Array<{ label: string; value: any }>;
  required?: boolean;
};
type CheckboxGrid = { getCheckboxRecords: () => any[] };

const props = defineProps<{ kind: PageKind }>();
const router = useRouter();

const statusOptions = [
  { label: '启用', value: 1 },
  { label: '停用', value: 0 },
];
const yesNoOptions = [
  { label: '是', value: 1 },
  { label: '否', value: 0 },
];
const dataPermOptions = [
  { label: '管理员', value: 99 },
  { label: '组长', value: 1 },
  { label: '组员', value: 0 },
];

const saving = ref(false);
const dialogOpen = ref(false);
const dialogTitle = ref('');
const selectedKeys = ref<any[]>([]);
const channelOptions = ref<Array<{ label: string; value: any }>>([]);
const groupOptions = ref<Array<{ label: string; value: any }>>([]);
const currentUser = ref<any>(null);
const form = reactive<Record<string, any>>({});

const title = computed(() => {
  if (props.kind === 'set-channel') return '渠道设置';
  if (props.kind === 'team') return '渠道分组';
  if (props.kind === 'user') return '渠道用户';
  return '渠道管理';
});

const formFields = computed<Field[]>(() => {
  if (props.kind === 'team') {
    return [
      { hidden: true, key: 'id', label: 'ID' },
      { key: 'name', label: '渠道组名', required: true },
      {
        key: 'cid',
        kind: 'select',
        label: '渠道',
        options: channelOptions.value,
        required: true,
      },
      { key: 'state', kind: 'select', label: '状态', options: statusOptions },
      { key: 'remark', kind: 'textarea', label: '备注' },
    ];
  }
  if (props.kind === 'user') {
    return [
      { hidden: true, key: 'uid', label: 'UID' },
      { key: 'name', label: '用户名', required: true },
      {
        key: 'cid',
        kind: 'select',
        label: '渠道',
        options: channelOptions.value,
        required: true,
      },
      {
        key: 'gid',
        kind: 'select',
        label: '渠道组',
        options: groupOptions.value,
        required: true,
      },
      {
        key: 'data_perm',
        kind: 'select',
        label: '权限',
        options: dataPermOptions,
      },
      { key: 'state', kind: 'select', label: '状态', options: statusOptions },
      { key: 'remark', kind: 'textarea', label: '备注' },
    ];
  }
  const fields: Field[] = [
    { hidden: true, key: 'id', label: 'ID' },
    { key: 'name', label: '渠道名', required: true },
  ];
  if (props.kind === 'set-channel') {
    fields.push(
      { key: 'group_cnt_limit', kind: 'number', label: '渠道组限制个数' },
      { key: 'user_cnt_limit', kind: 'number', label: '渠道用户限制个数' },
      {
        key: 'is_all_auth',
        kind: 'select',
        label: '是否全部授权',
        options: yesNoOptions,
      },
    );
  }
  fields.push(
    { key: 'state', kind: 'select', label: '状态', options: statusOptions },
    { key: 'remark', kind: 'textarea', label: '备注' },
  );
  return fields;
});

function col(field: string, title: string, width = 140) {
  return { field, title, width };
}

function useColumns(): VxeTableGridColumns {
  const base: Record<PageKind, any[]> = {
    channel: [
      col('name', '渠道名'),
      col('remark', '备注'),
      col('state', '状态', 90),
      col('create_time', '时间', 180),
    ],
    'set-channel': [
      col('id', 'ID', 70),
      col('name', '渠道名'),
      col('group_cnt_limit', '渠道组限制', 130),
      col('user_cnt_limit', '渠道用户限制', 140),
      col('is_all_auth', '全部授权', 100),
      col('state', '状态', 90),
      col('remark', '备注'),
      col('create_time', '时间', 180),
    ],
    team: [
      col('name', '渠道组名'),
      col('cid', '渠道ID', 100),
      col('remark', '备注'),
      col('state', '状态', 90),
      col('create_time', '时间', 180),
    ],
    user: [
      col('uid', '用户ID', 90),
      col('user_name', '用户名'),
      col('cid', '渠道ID', 90),
      col('cname', '渠道名称'),
      col('group_id', '渠道组ID', 100),
      col('gname', '渠道组名称'),
      col('data_perm', '权限', 90),
      col('remark', '备注'),
      col('state', '状态', 90),
      col('create_time', '时间', 180),
    ],
  };
  const columns: VxeTableGridColumns = [
    { field: 'id', fixed: 'left', title: 'ID', width: 80 },
    ...base[props.kind].map((column) => ({
      ...column,
      slots: slotFor(column.field),
    })),
    {
      align: 'right',
      field: 'operation',
      fixed: 'right',
      headerAlign: 'center',
      slots: { default: 'operation' },
      title: '操作',
      width: props.kind === 'user' ? 100 : 180,
    },
  ];
  if (props.kind !== 'team' && props.kind !== 'user')
    columns.unshift({ fixed: 'left', type: 'checkbox', width: 46 });
  return columns;
}

function slotFor(field: string) {
  if (field === 'state') return { default: 'state' };
  if (field === 'is_all_auth') return { default: 'isAllAuth' };
  if (field === 'data_perm') return { default: 'dataPerm' };
  return undefined;
}

function useGridFormSchema(): VbenFormSchema[] {
  const common: VbenFormSchema[] = [
    { component: 'Input', fieldName: 'name.contains', label: '名称' },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: statusOptions },
      fieldName: 'state.eq',
      label: '状态',
    },
  ];
  if (props.kind === 'user') {
    return [
      {
        component: 'Input',
        fieldName: 'user_name.contains',
        label: '用户名称',
      },
      {
        component: 'Select',
        componentProps: () => ({
          allowClear: true,
          options: channelOptions.value,
          showSearch: true,
        }),
        fieldName: 'cid.eq',
        label: '渠道',
      },
      {
        component: 'Select',
        componentProps: () => ({
          allowClear: true,
          options: groupOptions.value,
          showSearch: true,
        }),
        fieldName: 'group_id.eq',
        label: '渠道组',
      },
      {
        component: 'Select',
        componentProps: { allowClear: true, options: statusOptions },
        fieldName: 'state.eq',
        label: '状态',
      },
    ];
  }
  if (props.kind === 'set-channel') {
    return [
      ...common,
      {
        component: 'Select',
        componentProps: { allowClear: true, options: yesNoOptions },
        fieldName: 'is_all_auth.eq',
        label: '全部授权',
      },
    ];
  }
  return common;
}

function clean(values: Record<string, any>) {
  return Object.fromEntries(
    Object.entries(values).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  );
}

function normalizeList(payload: any) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.list)) return payload.list;
  if (Array.isArray(payload?.records)) return payload.records;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return payload ? [payload] : [];
}

async function apiList(params: Record<string, any>) {
  if (props.kind === 'team') return ditch.getTeamList(params);
  if (props.kind === 'user') return ditch.getUserList(params);
  return ditch.getPageList(params);
}

async function apiSave(payload: Record<string, any>) {
  if (props.kind === 'team') return ditch.saveTeam(payload);
  if (props.kind === 'user')
    return payload.uid ? ditch.updateUser(payload) : ditch.saveUser(payload);
  if (props.kind === 'set-channel')
    return payload.id ? ditch.updatePage(payload) : ditch.savePage(payload);
  return ditch.savePage(payload);
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: { schema: useGridFormSchema(), submitOnChange: true },
  gridEvents: { checkboxAll: updateSelected, checkboxChange: updateSelected },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) =>
          apiList(
            clean({
              ...formValues,
              page: page.currentPage,
              size: page.pageSize,
            }),
          ),
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
  } as VxeTableGridOptions,
});

function updateSelected() {
  selectedKeys.value = checkedRows().map((row) => row.id);
}

function checkedRows() {
  const grid = gridApi.grid as unknown as CheckboxGrid | undefined;
  return grid?.getCheckboxRecords() ?? [];
}

async function loadOptions() {
  const [channels, groups] = await Promise.allSettled([
    ditch.getPageListNoPage({ page: 1, size: 500 }),
    ditch.getTeamAllList({ page: 1, size: 500 }),
  ]);
  if (channels.status === 'fulfilled') {
    channelOptions.value = normalizeList(channels.value).map((item: any) => ({
      label: item.name || item.id,
      value: item.id,
    }));
  }
  if (groups.status === 'fulfilled') {
    groupOptions.value = normalizeList(groups.value).map((item: any) => ({
      label: item.name || item.id,
      value: item.id,
    }));
  }
}

async function loadCurrentUser() {
  try {
    currentUser.value = await ditch.getChannelUserInfo();
  } catch {
    currentUser.value = null;
  }
}

function openCreate() {
  Object.keys(form).forEach((key) => Reflect.deleteProperty(form, key));
  form.state = 1;
  if (props.kind === 'user' && currentUser.value?.group_id)
    form.gid = currentUser.value.group_id;
  dialogTitle.value = `新增${title.value}`;
  dialogOpen.value = true;
}

function openEdit(row: any) {
  Object.keys(form).forEach((key) => Reflect.deleteProperty(form, key));
  Object.assign(form, JSON.parse(JSON.stringify(row ?? {})));
  if (props.kind === 'user') {
    form.name = row.user_name ?? row.name;
    form.gid = row.group_id ?? row.gid;
  }
  dialogTitle.value = `编辑${title.value}`;
  dialogOpen.value = true;
}

async function submit() {
  saving.value = true;
  try {
    const result = await apiSave(JSON.parse(JSON.stringify(form)));
    message.success('保存成功');
    dialogOpen.value = false;
    if (result?.name && result?.pwd) {
      Modal.success({
        content: `用户名:${result.name} 密码:${result.pwd}，请妥善保存`,
        title: '账号已创建',
      });
    }
    await gridApi.query();
  } finally {
    saving.value = false;
  }
}

function canCreate() {
  if (props.kind === 'team')
    return !currentUser.value || currentUser.value.data_perm === 99;
  if (props.kind === 'user')
    return !currentUser.value || currentUser.value.data_perm !== 0;
  return true;
}

function canEdit(row: any) {
  if (props.kind !== 'user') return canCreate();
  if (!currentUser.value) return true;
  if (currentUser.value.uid === row.uid) return false;
  if (currentUser.value.data_perm === 99) return true;
  return (
    currentUser.value.data_perm === 1 &&
    row.data_perm < 1 &&
    currentUser.value.group_id === row.group_id
  );
}

function goAuth(row: any) {
  router.push({
    path: props.kind === 'set-channel' ? '/set/ditch/source' : '/ditch/source',
    query: { cid: row.id },
  });
}

function goBatchAuth() {
  const ids = checkedRows()
    .map((row) => row.id)
    .join(',');
  if (!ids) return message.warning('请选择渠道');
  router.push({
    path: props.kind === 'set-channel' ? '/set/ditch/source' : '/ditch/source',
    query: { cid: ids },
  });
}

function dataPermText(value: any) {
  return (
    dataPermOptions.find((item) => item.value === Number(value))?.label ??
    value ??
    '-'
  );
}

function stateTag(value: any) {
  return Number(value) === 1
    ? { color: 'success', text: '启用' }
    : { color: 'default', text: '停用' };
}

loadOptions();
loadCurrentUser();
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
    :title="title"
  >
    <Grid class="management-grid" :table-title="title">
      <template #toolbar-tools>
        <Button v-if="canCreate()" type="primary" @click="openCreate">
          <Plus class="size-5" />
          新增
        </Button>
        <Button
          v-if="props.kind === 'channel'"
          :disabled="selectedKeys.length === 0"
          @click="goBatchAuth"
        >
          去授权{{ selectedKeys.length || '' }}
        </Button>
        <Button
          v-if="props.kind === 'set-channel'"
          :disabled="selectedKeys.length === 0"
          @click="goBatchAuth"
        >
          批量授权{{ selectedKeys.length || '' }}
        </Button>
      </template>
      <template #state="{ row, column }">
        <Tag :color="stateTag(row[column.field]).color">
          {{ stateTag(row[column.field]).text }}
        </Tag>
      </template>
      <template #isAllAuth="{ row }">
        <Tag :color="Number(row.is_all_auth) === 1 ? 'success' : 'default'">
          {{ Number(row.is_all_auth) === 1 ? '是' : '否' }}
        </Tag>
      </template>
      <template #dataPerm="{ row }">{{ dataPermText(row.data_perm) }}</template>
      <template #operation="{ row }">
        <VbenTableAction
          :actions="[
            {
              disabled: !canEdit(row),
              icon: 'lucide:edit',
              onClick: () => openEdit(row),
              text: '编辑',
            },
            {
              ifShow: props.kind === 'channel' || props.kind === 'set-channel',
              icon: 'lucide:key-round',
              onClick: () => goAuth(row),
              text: '授权资源',
            },
          ]"
          align="center"
        />
      </template>
    </Grid>

    <Modal
      v-model:open="dialogOpen"
      :confirm-loading="saving"
      :title="dialogTitle"
      width="720px"
      @ok="submit"
    >
      <Form layout="vertical">
        <template v-for="field in formFields" :key="field.key">
          <FormItem
            v-if="!field.hidden"
            :label="field.label"
            :required="field.required"
          >
            <InputNumber
              v-if="field.kind === 'number'"
              v-model:value="form[field.key]"
              class="w-full"
              :min="0"
            />
            <Select
              v-else-if="field.kind === 'select'"
              v-model:value="form[field.key]"
              allow-clear
              :options="field.options"
              show-search
            />
            <TextArea
              v-else-if="field.kind === 'textarea'"
              v-model:value="form[field.key]"
              :rows="3"
            />
            <Input v-else v-model:value="form[field.key]" />
          </FormItem>
        </template>
      </Form>
    </Modal>
  </Page>
</template>
