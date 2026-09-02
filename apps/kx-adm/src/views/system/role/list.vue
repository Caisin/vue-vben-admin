<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

import type { Recordable } from '@vben/types';

import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { SystemRole } from '#/api';
import type { StatusValue } from '#/api/system/shared';

import { computed, reactive, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import {
  Form as AntForm,
  Button,
  FormItem,
  Input,
  message,
  Modal,
} from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { SystemRoleApi } from '#/api';
import { $t } from '#/locales';
import { Times } from '#/times';

import { useColumns, useGridFormSchema } from './data';
import Detail from './modules/detail.vue';
import Form from './modules/form.vue';

interface RoleSearchFormValues extends Record<string, unknown> {
  createTime?: [Dayjs, Dayjs];
}

const roleSearchCodec = Times.createDateRangeCodec<RoleSearchFormValues>()({
  endField: 'endTime',
  rangeField: 'createTime',
  startField: 'startTime',
});

type RoleSearchSubmitValues = ReturnType<typeof roleSearchCodec.encode>;

const { hasAccessByCodes } = useAccess();
const canManageRoles = computed(() => hasAccessByCodes(['roles:manage']));
const copyOpen = ref(false);
const copySubmitting = ref(false);
const copySource = ref<SystemRole>();
const copyForm = reactive({ id: '', name: '' });

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [DetailDrawer, detailDrawerApi] = useVbenDrawer({
  connectedComponent: Detail,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    codec: roleSearchCodec,
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(
      onActionClick,
      onStatusChange,
      () => canManageRoles.value,
    ),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues: RoleSearchSubmitValues) => {
          return await SystemRoleApi.list({
            page: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
          });
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
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<SystemRole>,
});

function onActionClick(e: OnActionClickParams<SystemRole>) {
  switch (e.code) {
    case 'copy': {
      onCopy(e.row);
      break;
    }
    case 'delete': {
      onDelete(e.row);
      break;
    }
    case 'detail': {
      onDetail(e.row);
      break;
    }
    case 'edit': {
      onEdit(e.row);
      break;
    }
  }
}

/**
 * 将Antd的Modal.confirm封装为promise，方便在异步函数中调用。
 * @param content 提示内容
 * @param title 提示标题
 */
function confirm(content: string, title: string) {
  return new Promise((reslove, reject) => {
    Modal.confirm({
      content,
      onCancel() {
        reject(new Error('已取消'));
      },
      onOk() {
        reslove(true);
      },
      title,
    });
  });
}

/**
 * 状态开关即将改变
 * @param newStatus 期望改变的状态值
 * @param row 行数据
 * @returns 返回false则中止改变，返回其他值（undefined、true）则允许改变
 */
async function onStatusChange(newStatus: number, row: SystemRole) {
  if (!canManageRoles.value) return false;
  const status: Recordable<string> = {
    0: '禁用',
    1: '启用',
  };
  try {
    await confirm(
      `你要将${row.name}的状态切换为 【${status[newStatus.toString()]}】 吗？`,
      `切换状态`,
    );
    await SystemRoleApi.update(row.id, { status: newStatus as StatusValue });
    return true;
  } catch {
    return false;
  }
}

function onEdit(row: SystemRole) {
  formDrawerApi.setData(row).open();
}

function onDetail(row: SystemRole) {
  detailDrawerApi.setData(row).open();
}

function onDelete(row: SystemRole) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.name]),
    duration: 0,
    key: 'action_process_msg',
  });
  SystemRoleApi.remove(row.id)
    .then(() => {
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.name]),
        key: 'action_process_msg',
      });
      onRefresh();
    })
    .catch(() => {
      hideLoading();
    });
}

function onCopy(row: SystemRole) {
  copySource.value = row;
  copyForm.id = `${row.id}_copy`;
  copyForm.name = `${row.name}副本`;
  copyOpen.value = true;
}

async function submitCopy() {
  const source = copySource.value;
  const id = copyForm.id.trim();
  const name = copyForm.name.trim();
  if (!source || !id || !name) {
    message.warning('请填写新角色编码和名称');
    return;
  }
  copySubmitting.value = true;
  try {
    await SystemRoleApi.copy(source.id, { id, name });
    message.success(`已复制为角色“${name}”`);
    copyOpen.value = false;
    await onRefresh();
  } finally {
    copySubmitting.value = false;
  }
}

function onRefresh() {
  gridApi.query();
}

function onCreate() {
  formDrawerApi.setData({}).open();
}
</script>
<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <FormDrawer @success="onRefresh" />
    <DetailDrawer />
    <Grid class="management-grid" :table-title="$t('system.role.list')">
      <template #toolbar-tools>
        <Button v-if="canManageRoles" type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('system.role.name')]) }}
        </Button>
      </template>
    </Grid>
    <Modal
      v-model:open="copyOpen"
      :confirm-loading="copySubmitting"
      title="复制角色"
      @ok="submitCopy"
    >
      <AntForm layout="vertical">
        <FormItem label="源角色">
          <Input :value="copySource?.name" disabled />
        </FormItem>
        <FormItem label="新角色编码" required>
          <Input v-model:value="copyForm.id" :maxlength="64" />
        </FormItem>
        <FormItem label="新角色名称" required>
          <Input v-model:value="copyForm.name" :maxlength="64" />
        </FormItem>
      </AntForm>
    </Modal>
  </Page>
</template>
