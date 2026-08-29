<script lang="ts" setup>
import type {
  VxeTableGridColumns,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';

import { computed, nextTick, ref, watch } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Badge,
  Button,
  Card,
  Empty,
  Form,
  FormItem,
  Input,
  message,
  Popconfirm,
  Select,
  Space,
  Spin,
  Tag,
} from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  getDefaultTemplates,
  getListNoPage,
  getTmpDetail,
  saveDefaultTemplate,
} from '#/api/res/seas/global/tmplate_lib';
const loading = ref(false);
const detailLoading = ref(false);
const rows = ref<any[]>([]);
const filterName = ref('');
const platform = ref<'app' | 'web'>('web');
const defaults = ref<any>({});
const activeId = ref<any>();
const detail = ref<any>({});
const items = ref<any[]>([]);
const columns: VxeTableGridColumns = [
  { field: 'id', fixed: 'left', title: '模板ID', width: 90 },
  { field: 'name', minWidth: 180, title: '模板名称' },
  {
    field: 'enabled',
    slots: { default: 'enabled' },
    title: '状态',
    width: 90,
  },
  { field: 'remark', minWidth: 180, showOverflow: 'tooltip', title: '备注' },
  {
    align: 'right',
    field: 'operation',
    fixed: 'right',
    headerAlign: 'center',
    slots: { default: 'operation' },
    title: '操作',
    width: 130,
  },
];
const filteredRows = computed(() => {
  const key = filterName.value.trim().toLowerCase();
  if (!key) return rows.value;
  return rows.value.filter((row) =>
    `${row.name ?? ''}${row.remark ?? ''}`.toLowerCase().includes(key),
  );
});
const defaultId = computed(() =>
  platform.value === 'web'
    ? defaults.value.web_template_id
    : defaults.value.app_template_id,
);
const vipItems = computed(() =>
  items.value.filter((item) => item.item_type === 'vip'),
);
const normalItems = computed(() =>
  items.value.filter((item) => item.item_type !== 'vip'),
);

const [Grid, gridApi] = useVbenVxeGrid<any>({
  gridEvents: {
    cellClick: ({ row }: { row: any }) => selectRow(row),
  },
  gridOptions: {
    columns,
    height: 'auto',
    pagerConfig: { enabled: false },
    rowClassName: ({ row }: { row: any }) =>
      row.id === activeId.value ? 'bg-blue-50' : '',
    rowConfig: { keyField: 'id' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: false,
      search: false,
      zoom: true,
    },
  } as VxeTableGridOptions,
});
async function loadDefaults() {
  try {
    defaults.value = await getDefaultTemplates();
    activeId.value = defaultId.value;
  } catch {
    defaults.value = {};
  }
}
async function loadRows() {
  loading.value = true;
  try {
    rows.value = await getListNoPage({});
    await loadDefaults();
    await reloadGrid();
    if (activeId.value) await selectRow({ id: activeId.value });
  } finally {
    loading.value = false;
  }
}
async function selectRow(row: any) {
  const id = row.id;
  if (!id) return;
  activeId.value = id;
  detailLoading.value = true;
  try {
    const res = await getTmpDetail({ id });
    detail.value = res?.info ?? row;
    items.value = res?.items ?? [];
  } finally {
    detailLoading.value = false;
  }
}
async function setDefault(row: any) {
  await saveDefaultTemplate(platform.value, row.id);
  message.success(
    `${platform.value === 'web' ? 'H5' : 'App'} 默认模板设置成功`,
  );
  await loadDefaults();
}
async function reloadGrid() {
  await nextTick();
  await gridApi.grid.reloadData(filteredRows.value);
}

async function changePlatform() {
  activeId.value = defaultId.value;
  if (activeId.value) await selectRow({ id: activeId.value });
  else {
    detail.value = {};
    items.value = [];
  }
}
watch(filteredRows, reloadGrid);
loadRows();
</script>
<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
    title="默认模板配置"
  >
    <div class="flex h-full gap-4">
      <Card class="w-[420px] shrink-0" title="当前模板预览">
        <Spin :spinning="detailLoading">
          <h3>{{ detail.name || '未选择模板' }}</h3>
          <Card class="mb-3" size="small" title="VIP 商品">
            <Space v-if="vipItems.length" direction="vertical">
              <div v-for="item in vipItems" :key="item.id || item.title">
                <Tag>VIP</Tag>{{ item.title }} / {{ item.amount }} 美分 /
                {{ item.vip_days || 0 }} 天
              </div>
</Space><Empty v-else />
          </Card>
          <Card size="small" title="普通/章节商品">
            <Space v-if="normalItems.length" direction="vertical">
              <div v-for="item in normalItems" :key="item.id || item.title">
                <Tag>{{ item.item_type }}</Tag>{{ item.title }} / {{ item.amount }} 美分
              </div>
</Space><Empty v-else />
          </Card>
        </Spin>
      </Card>
      <Card class="min-w-0 flex-1" title="模板列表">
        <Form layout="inline" class="mb-3">
          <FormItem label="平台">
            <Select
              v-model:value="platform"
              class="w-[160px]"
              :options="[
                { label: 'H5', value: 'web' },
                { label: 'App', value: 'app' },
              ]"
              @change="changePlatform"
            />
</FormItem><FormItem label="搜索">
            <Input
              v-model:value="filterName"
              allow-clear
              class="w-[220px]"
            />
</FormItem><FormItem>
            <Button :loading="loading" @click="loadRows"> 刷新 </Button>
          </FormItem>
        </Form>
        <Grid :loading="loading" table-title="模板列表">
          <template #enabled="{ row }">
            <Badge
              :status="row.enabled ? 'success' : 'error'"
              :text="row.enabled ? '启用' : '停用'"
            />
          </template>
          <template #operation="{ row }">
            <Popconfirm title="确认设置为默认？" @confirm="setDefault(row)">
              <Button type="link" size="small" :disabled="row.id === defaultId">
                {{ row.id === defaultId ? '已默认' : '设为默认' }}
              </Button>
            </Popconfirm>
          </template>
        </Grid>
      </Card>
    </div>
  </Page>
</template>
