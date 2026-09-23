<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ResourceCode } from '#/api/res/seas/global/resource_codes';

import { ref } from 'vue';

import { Page } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message } from 'antdv-next';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import { ResourceCodeApi } from '#/api/res/seas/global/resource_codes';

import ResourceCodeManage from '../source_manage/modules/resource-code-manage.vue';
import { useColumns, useGridFormSchema } from './data';

const editorOpen = ref(false);
const active = ref<ResourceCode>();

const [Grid, gridApi] = useVbenVxeGrid<ResourceCode>({
  formOptions: { schema: useGridFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) =>
          ResourceCodeApi.list({
            keyword: formValues.keyword?.trim() || undefined,
            page: page.currentPage,
            size: page.pageSize,
          }),
      },
    },
    rowConfig: { keyField: 'code' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<ResourceCode>,
});

function openCreate() {
  active.value = undefined;
  editorOpen.value = true;
}

function openEdit(record: ResourceCode) {
  active.value = record;
  editorOpen.value = true;
}

async function saved() {
  editorOpen.value = false;
  message.success('作品编号已保存');
  await gridApi.query();
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
    title="作品编号管理"
  >
    <Grid class="management-grid" table-title="作品编号管理">
      <template #toolbar-tools>
        <Button type="primary" @click="openCreate">
          <Plus class="size-5" />
          新增作品编号
        </Button>
      </template>
      <template #updated_at="{ row }">
        {{
          row.updated_at
            ? new Date(row.updated_at * 1000).toLocaleString()
            : '-'
        }}
      </template>
      <template #operation="{ row }">
        <VbenTableAction
          :actions="[
            { icon: 'lucide:edit', text: '修改', onClick: () => openEdit(row) },
          ]"
          align="center"
        />
      </template>
    </Grid>
    <ResourceCodeManage
      v-model:open="editorOpen"
      :initial="active"
      @saved="saved"
    />
  </Page>
</template>
