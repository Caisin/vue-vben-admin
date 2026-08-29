<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type {
  VxeTableGridColumns,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';

import { computed, nextTick, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';

import {
  Button,
  Drawer,
  Form,
  FormItem,
  Image,
  message,
  Modal,
  Popconfirm,
  Select,
  Tag,
  TextArea,
  Tooltip,
} from 'antdv-next';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import { ditch, global } from '#/api/res/seas';

const props = withDefaults(defineProps<{ manage?: boolean }>(), {
  manage: false,
});
const route = useRoute();
const sourceApi = global.source_manage;

type CheckboxGrid = { getCheckboxRecords: () => any[] };

const saving = ref(false);
const selectedKeys = ref<any[]>([]);
const channelOptions = ref<Array<{ label: string; value: any }>>([]);
const sourceOptions = ref<Array<{ label: string; value: any }>>([]);
const authedIds = ref<Array<number | string>>([]);
const dialogOpen = ref(false);
const drawerOpen = ref(false);
const drawerTitle = ref('详情');
const drawerRows = ref<any[]>([]);
const videoUrl = ref('');
const activeCidValue = ref<any>(
  route.query.cid ? String(route.query.cid) : undefined,
);
const authForm = reactive<Record<string, any>>({ remark: '授权', res_ids: [] });

const title = computed(() => (props.manage ? '渠道资源授权设置' : '渠道资源'));
const cids = computed(() => parseIds(activeCidValue.value));
const primaryCid = computed(() => cids.value[0]);

function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Select',
      componentProps: () => ({
        allowClear: true,
        options: channelOptions.value,
        showSearch: true,
      }),
      defaultValue: route.query.cid ? String(route.query.cid) : undefined,
      fieldName: 'cid',
      label: '渠道',
    },
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: '名称、简介、分类或标签',
      },
      fieldName: 'keyword',
      label: '全文关键字',
    },
    { component: 'InputNumber', fieldName: 'id.eq', label: '资源 ID' },
  ];
}

function useColumns(): VxeTableGridColumns {
  return [
    { fixed: 'left', type: 'checkbox', width: 46 },
    { field: 'id', fixed: 'left', title: 'ID', width: 80 },
    { field: 'cover', slots: { default: 'cover' }, title: '封面', width: 90 },
    { field: 'res_name', minWidth: 220, title: '资源名称' },
    { field: 'res_type', title: '类型', width: 90 },
    {
      field: 'lang_info',
      slots: { default: 'langInfo' },
      title: '语言',
      width: 180,
    },
    { field: 'state', slots: { default: 'state' }, title: '状态', width: 90 },
    {
      field: 'intro',
      minWidth: 240,
      slots: { default: 'intro' },
      title: '简介',
    },
    { field: 'remark', title: '备注', width: 140 },
    {
      align: 'right',
      field: 'operation',
      fixed: 'right',
      headerAlign: 'center',
      slots: { default: 'operation' },
      title: '操作',
      width: props.manage ? 180 : 120,
    },
  ];
}

const drawerColumns = computed<VxeTableGridColumns>(() =>
  Object.keys(drawerRows.value[0] ?? {}).map((key) => ({
    field: key,
    title: key,
    width: 140,
  })),
);

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: { schema: useGridFormSchema(), submitOnChange: true },
  gridEvents: { checkboxAll: updateSelected, checkboxChange: updateSelected },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          activeCidValue.value = formValues.cid;
          selectedKeys.value = [];
          if (!primaryCid.value) {
            authedIds.value = [];
            message.warning('请选择渠道');
            return { items: [], total: 0 };
          }
          const { keyword, ...filters } = clean(formValues);
          const payload = props.manage
            ? await ditch.getSourceList({
                ...filters,
                cid: primaryCid.value,
                page: page.currentPage,
                'res_name.contains': keyword,
                size: page.pageSize,
              })
            : await sourceApi.getList({
                ...filters,
                cid: cids.value.join(','),
                keyword,
                page: page.currentPage,
                size: page.pageSize,
              });
          await loadAuthedIds();
          return payload;
        },
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

const [DrawerGrid, drawerGridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: [],
    height: 'auto',
    pagerConfig: { enabled: false },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: false,
      search: false,
      zoom: true,
    },
  } as VxeTableGridOptions,
});

function parseIds(value: any): Array<number | string> {
  if (Array.isArray(value)) return value.flatMap((item) => parseIds(item));
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => (Number.isFinite(Number(item)) ? Number(item) : item));
}

function clean(values: Record<string, any>) {
  return Object.fromEntries(
    Object.entries(values).filter(
      ([key, value]) =>
        key !== 'cid' && value !== undefined && value !== null && value !== '',
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

function updateSelected() {
  selectedKeys.value = checkedRows().map((row) => row.id);
}

function checkedRows() {
  const grid = gridApi.grid as unknown as CheckboxGrid | undefined;
  return grid?.getCheckboxRecords() ?? [];
}

async function loadOptions() {
  const [channels, sources] = await Promise.allSettled([
    ditch.getPageListNoPage({ page: 1, size: 500 }),
    sourceApi.getListAll({ page: 1, size: 1000 }),
  ]);
  if (channels.status === 'fulfilled') {
    channelOptions.value = normalizeList(channels.value).map((item: any) => ({
      label: item.name || item.id,
      value: item.id,
    }));
  }
  if (sources.status === 'fulfilled') {
    sourceOptions.value = normalizeList(sources.value).map((item: any) => ({
      label: item.res_name || item.title || item.id,
      value: item.id,
    }));
  }
}

async function loadAuthedIds() {
  if (!primaryCid.value) {
    authedIds.value = [];
    return;
  }
  try {
    const ids = await ditch.getAuthSourceIdList({ cid: primaryCid.value });
    authedIds.value = Array.isArray(ids) ? ids : normalizeList(ids);
  } catch {
    authedIds.value = [];
  }
}

function openAuthDialog(records?: any[]) {
  Object.assign(authForm, {
    cids: cids.value,
    remark: '授权',
    res_ids: records?.map((item) => item.id) ?? selectedKeys.value,
  });
  dialogOpen.value = true;
}

async function submitAuth() {
  saving.value = true;
  try {
    await ditch.authSource({
      cids: parseIds(authForm.cids),
      remark: authForm.remark || '授权',
      res_ids: parseIds(authForm.res_ids),
    });
    message.success('授权成功');
    dialogOpen.value = false;
    await gridApi.query();
  } finally {
    saving.value = false;
  }
}

async function unAuth(records: any[]) {
  const ids = records.map((item) => item.id).filter(Boolean);
  if (ids.length === 0) return message.warning('请选择资源');
  saving.value = true;
  try {
    await ditch.unAuthSource({
      cids: cids.value,
      remark: '取消授权',
      res_ids: ids,
    });
    message.success('取消授权成功');
    selectedKeys.value = [];
    await gridApi.query();
  } finally {
    saving.value = false;
  }
}

async function showAuthDetails() {
  if (!primaryCid.value) return message.warning('请选择渠道');
  const data = await ditch.getAuthSourceDetailList({
    cid: primaryCid.value,
    page: 1,
    size: 200,
  });
  drawerRows.value = normalizeList(data);
  drawerTitle.value = '已授权详情';
  drawerOpen.value = true;
  await nextTick();
  drawerGridApi.setGridOptions({ columns: drawerColumns.value });
  await drawerGridApi.grid.reloadData(drawerRows.value);
}

function langKeys(record: any) {
  return Object.keys(record.lang_info ?? {});
}

async function play(record: any) {
  try {
    const list = await sourceApi.getChapterListNoLangNoPage({
      res_id: record.id,
    });
    const first = normalizeList(list).find(
      (item: any) =>
        item.play_url || item.url || item.video_url || item.file_url,
    );
    videoUrl.value =
      first?.play_url ||
      first?.url ||
      first?.video_url ||
      first?.file_url ||
      '';
    if (!videoUrl.value) message.warning('没有可播放地址');
  } catch (error) {
    message.error(String((error as Error)?.message ?? error));
  }
}

function isAuthed(record: any) {
  return authedIds.value
    .map(String)
    .includes(String(record.id ?? record.res_id));
}

loadOptions();
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
    :title="title"
  >
    <div v-if="authedIds.length" class="mb-3 rounded border bg-card p-3">
      <div class="mb-2 text-sm font-medium">已授权资源 ID</div>
      <div class="flex flex-wrap gap-2">
        <Tag v-for="id in authedIds" :key="id" color="blue">{{ id }}</Tag>
      </div>
    </div>

    <video
      v-if="videoUrl"
      class="mb-3 max-h-[360px] w-full bg-black"
      controls
      :src="videoUrl"
    ></video>

    <Grid class="management-grid" :table-title="title">
      <template #toolbar-tools>
        <Button
          v-if="!props.manage"
          :disabled="selectedKeys.length === 0"
          type="primary"
          @click="openAuthDialog()"
        >
          批量授权{{ selectedKeys.length || '' }}
        </Button>
        <Button v-if="props.manage" type="primary" @click="openAuthDialog()">
          新增授权
        </Button>
        <Popconfirm
          v-if="props.manage"
          title="确认取消选中资源授权？"
          @confirm="unAuth(checkedRows())"
        >
          <Button danger :disabled="selectedKeys.length === 0">
            批量取消授权{{ selectedKeys.length || '' }}
          </Button>
        </Popconfirm>
        <Button @click="showAuthDetails">已授权 ID/详情</Button>
      </template>
      <template #cover="{ row }">
        <Image v-if="row.cover" :src="row.cover" :height="64" class="rounded" />
        <span v-else>-</span>
      </template>
      <template #langInfo="{ row }">
        <div class="flex flex-wrap gap-1">
          <Tag v-for="lang in langKeys(row)" :key="lang">{{ lang }}</Tag>
        </div>
      </template>
      <template #state="{ row }">
        <Tag :color="Number(row.state) === 1 ? 'success' : 'default'">
          {{ Number(row.state) === 1 ? '启用' : '停用' }}
        </Tag>
      </template>
      <template #intro="{ row }">
        <Tooltip :title="row.intro">
          <span class="line-clamp-1">{{ row.intro || '-' }}</span>
        </Tooltip>
      </template>
      <template #operation="{ row }">
        <VbenTableAction
          :actions="[
            { icon: 'lucide:play', onClick: () => play(row), text: '播放' },
            {
              ifShow: !props.manage && !isAuthed(row),
              icon: 'lucide:key-round',
              onClick: () => openAuthDialog([row]),
              text: '授权',
            },
          ]"
          :dropdown-actions="[
            {
              ifShow: props.manage,
              icon: 'lucide:x',
              popConfirm: {
                confirm: () => unAuth([row]),
                title: '确认取消授权？',
              },
              text: '取消授权',
            },
          ]"
          align="center"
        />
        <Tag v-if="!props.manage && isAuthed(row)" color="success">已授权</Tag>
      </template>
    </Grid>

    <Modal
      v-model:open="dialogOpen"
      :confirm-loading="saving"
      title="资源授权"
      width="760px"
      @ok="submitAuth"
    >
      <Form layout="vertical">
        <FormItem label="渠道" required>
          <Select
            v-model:value="authForm.cids"
            mode="multiple"
            :options="channelOptions"
            show-search
          />
        </FormItem>
        <FormItem label="资源" required>
          <Select
            v-model:value="authForm.res_ids"
            mode="multiple"
            :options="sourceOptions"
            show-search
          />
        </FormItem>
        <FormItem label="备注">
          <TextArea v-model:value="authForm.remark" :rows="3" />
        </FormItem>
      </Form>
    </Modal>

    <Drawer v-model:open="drawerOpen" :title="drawerTitle" :size="760">
      <DrawerGrid />
    </Drawer>
  </Page>
</template>
