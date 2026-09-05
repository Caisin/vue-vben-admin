<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { DataSourceView, DataSourceWrite } from '#/api/system';

import { computed, nextTick, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { createIconifyIcon, Plus } from '@vben/icons';

import {
  Button,
  Checkbox,
  Drawer,
  Input,
  message,
  Modal,
  Tag,
  Tooltip,
} from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { DataSourceApi } from '#/api/system';

import {
  useColumns,
  useFormSchema,
  useSearchSchema,
  writeValues,
} from './data';

const Edit = createIconifyIcon('lucide:pencil');
const Eye = createIconifyIcon('lucide:eye');
const Plug = createIconifyIcon('lucide:plug-zap');
const Trash = createIconifyIcon('lucide:trash-2');
const probeTarget = ref<DataSourceView>();
const probing = ref(false);
const probeOptions = reactive({ allow_insecure: false, warehouse: '' });

const open = ref(false);
const saving = ref(false);
const editing = ref<DataSourceView>();
const detail = ref<DataSourceView>();
const form = reactive<DataSourceWrite>({
  db_type: 'postgres',
  name: '',
  state: true,
});

const [Form, formApi] = useVbenForm({
  layout: 'vertical',
  wrapperClass: 'grid-cols-1 md:grid-cols-2',
  showDefaultActions: false,
  schema: useFormSchema(false),
});
const [Grid, gridApi] = useVbenVxeGrid<DataSourceView>({
  formOptions: { schema: useSearchSchema(), submitOnChange: true },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async ({ page }, values) =>
          DataSourceApi.list({
            ...values,
            page: page.currentPage,
            size: page.pageSize,
          }),
      },
    },
    rowConfig: { keyField: 'ds_code' },
    toolbarConfig: { custom: true, refresh: true, search: true, zoom: true },
  } as VxeTableGridOptions<DataSourceView>,
});

const title = computed(() => (editing.value ? '编辑数据源' : '新增数据源'));

async function edit(row?: DataSourceView) {
  if (row?.ds_code === 'base') return;
  editing.value = row;
  Object.assign(form, writeValues(row));
  await formApi.setState({ schema: useFormSchema(Boolean(row)) });
  // setValues 会等待 Form 挂载，必须先打开惰性挂载的 Drawer。
  open.value = true;
  await nextTick();
  await formApi.resetForm();
  await formApi.setValues(form);
}

async function save() {
  const { valid } = await formApi.validate();
  if (!valid) return;
  saving.value = true;
  try {
    const values = writeValues((await formApi.getValues()) as DataSourceWrite);
    if (editing.value) {
      const { ds_code: _code, ...data } = values;
      await DataSourceApi.update(editing.value.ds_code, data);
    } else await DataSourceApi.create(values);
    open.value = false;
    message.success('数据源已保存');
    await gridApi.query();
  } finally {
    saving.value = false;
  }
}

async function probe(row: DataSourceView) {
  if (row.db_type === 'databend') {
    Object.assign(probeOptions, { allow_insecure: false, warehouse: '' });
    probeTarget.value = row;
    return;
  }
  await testConnection(row);
}

async function testConnection(row: DataSourceView) {
  probing.value = true;
  try {
    const result = await DataSourceApi.probe(
      row.ds_code,
      row.db_type === 'databend' ? { ...probeOptions } : {},
    );
    if (result.reachable) {
      message.success(result.message);
      probeTarget.value = undefined;
    } else message.error(result.message);
  } finally {
    probing.value = false;
  }
}

function remove(row: DataSourceView) {
  Modal.confirm({
    title: '删除数据源',
    content: `确认删除“${row.name}”吗？已绑定此数据源的业务将无法连接。`,
    okType: 'danger',
    onOk: async () => {
      await DataSourceApi.remove(row.ds_code);
      message.success('已删除');
      await gridApi.query();
    },
  });
}

function showDetail(row: DataSourceView) {
  detail.value = row;
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
    title="数据源管理"
  >
    <Grid class="management-grid" table-title="数据源管理">
      <template #toolbar-tools>
        <Button type="primary" @click="edit()">
          <Plus class="size-5" />新增数据源
        </Button>
      </template>
      <template #db_type="{ row }">{{ row.db_type }}</template>
      <template #credential_configured="{ row }">
        <Tag :color="row.credential_configured ? 'success' : 'default'">
          {{ row.credential_configured ? '已配置' : '未配置' }}
        </Tag>
      </template>
      <template #state="{ row }">
        <Tag :color="row.state ? 'success' : 'default'">
          {{ row.state ? '启用' : '停用' }}
        </Tag>
      </template>
      <template #operation="{ row }">
        <div class="flex items-center gap-1">
          <Tooltip title="详情">
            <Button type="text" aria-label="详情" @click="showDetail(row)">
              <Eye class="size-4" />
            </Button>
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="text"
              aria-label="编辑"
              :disabled="row.ds_code === 'base'"
              @click="edit(row)"
            >
              <Edit class="size-4" />
            </Button>
          </Tooltip>
          <Tooltip title="测试连接">
            <Button
              type="text"
              aria-label="测试连接"
              :disabled="probing"
              @click="probe(row)"
            >
              <Plug class="size-4" />
            </Button>
          </Tooltip>
          <Tooltip title="删除">
            <Button
              type="text"
              danger
              aria-label="删除"
              :disabled="row.ds_code === 'base'"
              @click="remove(row)"
            >
              <Trash class="size-4" />
            </Button>
          </Tooltip>
        </div>
      </template>
    </Grid>
    <Drawer
      v-model:open="open"
      :title="title"
      size="min(720px, 100vw)"
      destroy-on-hidden
    >
      <Form />
      <template #footer>
        <Button @click="open = false">取消</Button><Button :loading="saving" type="primary" @click="save"> 保存 </Button>
      </template>
    </Drawer>
    <Drawer
      :open="Boolean(detail)"
      title="数据源详情"
      size="min(520px, 100vw)"
      @close="detail = undefined"
    >
      <template v-if="detail">
        <dl class="grid grid-cols-2 gap-4">
          <div>
            <dt>编码</dt>
            <dd>{{ detail.ds_code }}</dd>
          </div>
          <div>
            <dt>名称</dt>
            <dd>{{ detail.name }}</dd>
          </div>
          <div>
            <dt>类型</dt>
            <dd>{{ detail.db_type }}</dd>
          </div>
          <div>
            <dt>主机</dt>
            <dd>{{ detail.db_host || '本地' }}</dd>
          </div>
          <div>
            <dt>数据库</dt>
            <dd>{{ detail.db_name }}</dd>
          </div>
          <div>
            <dt>用户名</dt>
            <dd>{{ detail.user_name || '未配置' }}</dd>
          </div>
          <div>
            <dt>密码凭证</dt>
            <dd>
              {{
                detail.credential_code ||
                (detail.credential_configured ? '旧配置' : '未配置')
              }}
            </dd>
          </div>
          <div>
            <dt>状态</dt>
            <dd>{{ detail.state ? '启用' : '停用' }}</dd>
          </div>
        </dl>
      </template>
    </Drawer>
    <Modal
      :open="!!probeTarget"
      title="测试 Databend 连接"
      ok-text="开始测试"
      :confirm-loading="probing"
      @ok="probeTarget && testConnection(probeTarget)"
      @cancel="probeTarget = undefined"
    >
      <p class="mb-4">
        {{ probeTarget?.db_host }}:{{ probeTarget?.port || 8000 }} /
        {{ probeTarget?.db_name }}
      </p>
      <label class="mb-4 flex flex-col gap-2">计算仓库<Input
          v-model:value="probeOptions.warehouse"
          placeholder="默认仓库"
      /></label>
      <Checkbox v-model:checked="probeOptions.allow_insecure">
        允许 HTTP 测试连接
      </Checkbox>
    </Modal>
  </Page>
</template>
