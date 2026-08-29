<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { SystemMenu } from '#/api/system/menu';

import { h, ref } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { IconifyIcon, Plus } from '@vben/icons';
import { $t } from '@vben/locales';

import { MenuBadge } from '@vben-core/menu-ui';

import { Button, Checkbox, message, Modal } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { SystemMenuApi } from '#/api/system/menu';

import { useColumns } from './data';
import Form from './modules/form.vue';

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useColumns(onActionClick, onStatusChange),
    height: 'auto',
    keepSource: true,
    pagerConfig: {
      enabled: false,
    },
    proxyConfig: {
      ajax: {
        query: async (_params) => {
          return await SystemMenuApi.list();
        },
      },
    },
    rowConfig: {
      keyField: 'id',
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      zoom: true,
    },
    treeConfig: {
      parentField: 'pid',
      rowField: 'id',
      transform: false,
    },
  } as VxeTableGridOptions,
});

function onActionClick({ code, row }: OnActionClickParams<SystemMenu>) {
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
    default: {
      break;
    }
  }
}

async function onStatusChange(status: SystemMenu['status'], row: SystemMenu) {
  await SystemMenuApi.update(row.id, {
    authCode: row.authCode,
    component: row.component,
    meta: row.meta,
    name: row.name,
    path: row.path,
    pid: row.pid,
    redirect: row.redirect,
    status,
    type: row.type,
  });
  return true;
}

function onRefresh() {
  gridApi.query();
}

function menuTitle(row: SystemMenu) {
  const title = row.meta?.title;
  return typeof title === 'string' && title ? $t(title) : row.name;
}

function onEdit(row: SystemMenu) {
  formDrawerApi.setData(row).open();
}
function onCreate() {
  formDrawerApi.setData({}).open();
}
function onAppend(row: SystemMenu) {
  formDrawerApi.setData({ pid: row.id }).open();
}

function onDelete(row: SystemMenu) {
  const cascade = ref(false);
  Modal.confirm({
    content: () =>
      h(
        Checkbox,
        {
          checked: cascade.value,
          'onUpdate:checked': (checked: boolean) => {
            cascade.value = checked;
          },
        },
        {
          default: () => '级联删除下级菜单和按钮',
        },
      ),
    okText: '删除',
    okType: 'danger',
    async onOk() {
      const hideLoading = message.loading({
        content: $t('ui.actionMessage.deleting', [row.name]),
        duration: 0,
        key: 'action_process_msg',
      });
      try {
        await SystemMenuApi.remove(row.id, cascade.value);
      } catch (error) {
        hideLoading();
        throw error;
      }
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.name]),
        key: 'action_process_msg',
      });
      onRefresh();
    },
    title: `确认删除菜单「${row.name}」？`,
  });
}
</script>
<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <FormDrawer @success="onRefresh" />
    <Grid class="management-grid">
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('system.menu.name')]) }}
        </Button>
      </template>
      <template #title="{ row }">
        <div class="flex w-full items-center gap-1">
          <div class="size-5 shrink-0">
            <IconifyIcon
              v-if="row.type === 'button'"
              icon="carbon:security"
              class="size-full"
            />
            <IconifyIcon
              v-else-if="row.meta?.icon"
              :icon="row.meta?.icon || 'carbon:circle-dash'"
              class="size-full"
            />
          </div>
          <span class="flex-auto">{{ menuTitle(row) }}</span>
          <div class="items-center justify-end"></div>
        </div>
        <MenuBadge
          v-if="row.meta?.badgeType"
          class="menu-badge"
          :badge="row.meta.badge"
          :badge-type="row.meta.badgeType"
          :badge-variants="row.meta.badgeVariants"
        />
      </template>
    </Grid>
  </Page>
</template>
<style lang="scss" scoped>
.menu-badge {
  top: 50%;
  right: 0;
  transform: translateY(-50%);

  & > :deep(div) {
    padding-top: 0;
    padding-bottom: 0;
  }
}
</style>
