<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { DataSourceView, DataSourceWrite } from '#/api/system';

import { computed, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, Drawer, message, Modal, Tag } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import { DataSourceApi } from '#/api/system';

import { useColumns, useFormSchema, useSearchSchema } from './data';

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
  editing.value = row;
  Object.assign(
    form,
    row
      ? { ...row }
      : {
          db_type: 'postgres',
          ds_code: '',
          name: '',
          db_host: '',
          db_name: '',
          user_name: '',
          credential_code: '',
          cur_schema: '',
          time_zone: '',
          port: 0,
          state: true,
          remark: '',
        },
  );
  await formApi.setState({ schema: useFormSchema(Boolean(row)) });
  await formApi.setValues(form);
  open.value = true;
}

async function save() {
  const { valid } = await formApi.validate();
  if (!valid) return;
  saving.value = true;
  try {
    const values = (await formApi.getValues()) as DataSourceWrite;
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
  const result = await DataSourceApi.probe(row.ds_code);
  result.reachable
    ? message.success(result.message)
    : message.error(result.message);
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
        <VbenTableAction
          :actions="[
            {
              icon: 'lucide:eye',
              onClick: () => showDetail(row),
              tooltip: '详情',
            },
            {
              icon: 'lucide:plug-zap',
              onClick: () => probe(row),
              tooltip: '测试连接',
            },
          ]"
          :dropdown-actions="[
            { icon: 'lucide:edit', onClick: () => edit(row), text: '编辑' },
            {
              danger: true,
              icon: 'lucide:trash-2',
              onClick: () => remove(row),
              text: '删除',
            },
          ]"
        />
      </template>
    </Grid>
    <Drawer v-model:open="open" :title="title" :width="720" destroy-on-close>
      <Form />
      <template #footer>
        <Button @click="open = false">取消</Button><Button :loading="saving" type="primary" @click="save"> 保存 </Button>
      </template>
    </Drawer>
    <Drawer
      :open="Boolean(detail)"
      title="数据源详情"
      :width="520"
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
  </Page>
</template>
