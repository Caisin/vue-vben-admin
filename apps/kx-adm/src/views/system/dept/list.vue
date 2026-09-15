<script lang="ts" setup>
import type { DepartmentRow } from './company-tree';

import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { SystemDept } from '#/api/system/dept';

import { ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message, Switch, Tag } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { SystemDeptApi } from '#/api/system/dept';
import { $t } from '#/locales';

import { buildCompanyDepartmentTree } from './company-tree';
import { useColumns } from './data';
import Form from './modules/form.vue';

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

/**
 * 编辑部门
 * @param row
 */
function onEdit(row: SystemDept) {
  formModalApi.setData(row).open();
}

/**
 * 添加下级部门
 * @param row
 */
function onAppend(row: SystemDept) {
  formModalApi.setData({ pid: row.id }).open();
}

/**
 * 创建新部门
 */
function onCreate() {
  formModalApi.setData(null).open();
}

/**
 * 删除部门
 * @param row
 */
function onDelete(row: SystemDept) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.name]),
    duration: 0,
    key: 'action_process_msg',
  });
  SystemDeptApi.remove(row.id)
    .then(() => {
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.name]),
        key: 'action_process_msg',
      });
      refreshGrid();
    })
    .catch(() => {
      hideLoading();
    });
}

/**
 * 表格操作按钮的回调函数
 */
function onActionClick({ code, row }: OnActionClickParams<DepartmentRow>) {
  if (row.isCompany) return;
  switch (code) {
    case 'append': {
      onAppend(row);
      break;
    }
    case 'delete': {
      onDelete(row);
      break;
    }
    case 'edit': {
      onEdit(row);
      break;
    }
  }
}

const statusLoading = ref<Record<string, boolean>>({});
async function onStatusChange(
  status: SystemDept['status'],
  row: DepartmentRow,
) {
  if (row.isCompany) return;
  statusLoading.value[row.id] = true;
  try {
    await SystemDeptApi.update(row.id, {
      name: row.name,
      pid: row.pid,
      remark: row.remark,
      sortNo: row.sortNo,
      status,
    });
    row.status = status;
  } finally {
    statusLoading.value[row.id] = false;
  }
}

const [Grid, gridApi] = useVbenVxeGrid({
  gridEvents: {},
  gridOptions: {
    columns: useColumns(onActionClick),
    rowConfig: { keyField: 'id' },
    height: 'auto',
    keepSource: true,
    pagerConfig: {
      enabled: false,
    },
    proxyConfig: {
      ajax: {
        query: async (_params) => {
          const [companies, departments] = await Promise.all([
            SystemDeptApi.companies(),
            SystemDeptApi.list(),
          ]);
          return buildCompanyDepartmentTree(companies, departments);
        },
      },
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      zoom: true,
    },
    treeConfig: {
      reserve: true,
      parentField: 'pid',
      rowField: 'id',
      transform: false,
    },
  } as VxeTableGridOptions,
});

/**
 * 刷新表格
 */
function refreshGrid() {
  gridApi.query();
}
</script>
<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <FormModal @success="refreshGrid" />
    <Grid class="management-grid" table-title="部门列表">
      <template #deptStatus="{ row }">
        <Tag v-if="row.isCompany" color="blue">公司分组</Tag>
        <Switch
          v-else
          :checked="row.status === 1"
          :loading="statusLoading[row.id]"
          checked-children="启用"
          un-checked-children="禁用"
          @change="(value) => onStatusChange(value ? 1 : 0, row)"
        />
      </template>
      <template #toolbar-tools>
        <Button @click="gridApi.grid.setAllTreeExpand(true)">展开全部</Button>
        <Button @click="gridApi.grid.setAllTreeExpand(false)">收起全部</Button>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('system.dept.name')]) }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
