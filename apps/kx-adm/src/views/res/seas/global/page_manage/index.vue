<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import {
  Button,
  Card,
  Descriptions,
  DescriptionsItem,
  Form,
  FormItem,
  Input,
  message,
  Modal,
  Tag,
} from 'antdv-next';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import {
  getPageList,
  refreshPage,
  savePage,
} from '#/api/res/seas/global/page_manage';

import { useColumns, useGridFormSchema } from './data';

type PageCode = {
  created_at: number;
  page_code: string;
  page_name: string;
  remark: string;
};

const router = useRouter();
const saving = ref(false);
const editorOpen = ref(false);
const snapshotOpen = ref(false);
const snapshot = ref<any>();
const form = reactive<PageCode>(emptyPage());

function emptyPage(): PageCode {
  return { created_at: 0, page_code: '', page_name: '', remark: '' };
}

function normalizeRows(payload: any) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.records)) return payload.records;
  return payload ? [payload] : [];
}

function normalizeTotal(payload: any, list: any[]) {
  return Number(payload?.total ?? payload?.count ?? list.length);
}

const [Grid, gridApi] = useVbenVxeGrid<PageCode>({
  formOptions: {
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          const payload = await getPageList({
            page: page.currentPage,
            pageSize: page.pageSize,
          });
          let items = normalizeRows(payload);
          const keyword = formValues.keyword?.trim().toLowerCase();
          if (keyword) {
            items = items.filter((item: PageCode) =>
              `${item.page_code} ${item.page_name}`
                .toLowerCase()
                .includes(keyword),
            );
          }
          return { items, total: normalizeTotal(payload, items) };
        },
      },
    },
    rowConfig: { keyField: 'page_code' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<PageCode>,
});

function openEditor(record?: PageCode) {
  Object.assign(form, emptyPage(), record ?? {});
  editorOpen.value = true;
}

async function submit() {
  if (!form.page_code.trim() || !form.page_name.trim()) {
    message.warning('请填写页面编码和页面名称');
    return;
  }
  saving.value = true;
  try {
    await savePage({ ...form });
    editorOpen.value = false;
    message.success('页面配置已保存');
    await gridApi.query();
  } finally {
    saving.value = false;
  }
}

async function refresh(record: PageCode, showSnapshot = false) {
  const result = await refreshPage(record.page_code);
  message.success('页面配置已刷新');
  if (showSnapshot) {
    snapshot.value = result;
    snapshotOpen.value = true;
  }
}

function openModules(record: PageCode) {
  router.push({
    name: 'ResPageModule',
    query: { page_code: record.page_code, title: record.page_name },
  });
}

function formatTime(value: number) {
  if (!value) return '-';
  return new Date(value * 1000).toLocaleString();
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
    title="页面管理"
  >
    <Grid class="management-grid" table-title="页面管理">
      <template #toolbar-tools>
        <Button type="primary" @click="openEditor()">新增页面</Button>
      </template>
      <template #pageCode="{ row }">
        <Tag color="blue">{{ row.page_code }}</Tag>
      </template>
      <template #createdAt="{ row }">
        {{ formatTime(row.created_at) }}
      </template>
      <template #operation="{ row }">
        <VbenTableAction
          :actions="[
            {
              icon: 'lucide:edit',
              onClick: () => openEditor(row),
              text: '编辑',
            },
            {
              icon: 'lucide:blocks',
              onClick: () => openModules(row),
              text: '模块配置',
            },
          ]"
          :dropdown-actions="[
            {
              icon: 'lucide:refresh-cw',
              onClick: () => refresh(row),
              text: '刷新',
            },
            {
              icon: 'lucide:file-json',
              onClick: () => refresh(row, true),
              text: '快照',
            },
          ]"
          align="center"
        />
      </template>
    </Grid>

    <Modal
      v-model:open="editorOpen"
      :confirm-loading="saving"
      :title="form.created_at ? '编辑页面' : '新增页面'"
      @ok="submit"
    >
      <Form :label-col="{ span: 5 }" :model="form">
        <FormItem label="页面编码" required>
          <Input
            v-model:value="form.page_code"
            :disabled="form.created_at > 0"
          />
        </FormItem>
        <FormItem label="页面名称" required>
          <Input v-model:value="form.page_name" />
        </FormItem>
        <FormItem label="备注">
          <Input v-model:value="form.remark" />
        </FormItem>
      </Form>
    </Modal>

    <Modal
      v-model:open="snapshotOpen"
      :footer="null"
      title="页面运行快照"
      width="880px"
    >
      <Card v-if="snapshot?.code" size="small">
        <Descriptions bordered size="small">
          <DescriptionsItem label="页面编码">
            {{ snapshot.code.page_code }}
          </DescriptionsItem>
          <DescriptionsItem label="页面名称">
            {{ snapshot.code.page_name }}
          </DescriptionsItem>
          <DescriptionsItem label="模块数量">
            {{ snapshot.groups?.length ?? 0 }}
          </DescriptionsItem>
        </Descriptions>
      </Card>
      <pre class="snapshot-json">{{ JSON.stringify(snapshot, null, 2) }}</pre>
    </Modal>
  </Page>
</template>

<style scoped>
.snapshot-json {
  max-height: 55vh;
  margin: 12px 0 0;
  overflow: auto;
  white-space: pre-wrap;
}
</style>
