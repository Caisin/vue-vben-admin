<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { RoleUser, SystemRole } from '#/api/system/role';
import type { StatusValue } from '#/api/system/shared';
import type { SystemUser } from '#/api/system/user';

import { ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { Button, message, Modal, Select, Tag } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { SystemRoleApi } from '#/api/system/role';
import { SystemUserApi } from '#/api/system/user';

const role = ref<SystemRole>();
const addOpen = ref(false);
const addLoading = ref(false);
const candidateLoading = ref(false);
const selectedUid = ref<string>();
const candidates = ref<SystemUser[]>([]);

const [Grid, gridApi] = useVbenVxeGrid<RoleUser>({
  formOptions: {
    schema: [
      {
        component: 'Input',
        componentProps: { allowClear: true, placeholder: '姓名、电话或邮箱' },
        fieldName: 'keyword',
        label: '关键词',
      },
      {
        component: 'Select',
        componentProps: {
          allowClear: true,
          options: [
            { label: '启用', value: 1 },
            { label: '停用', value: 0 },
          ],
        },
        fieldName: 'status',
        label: '状态',
      },
    ],
    submitOnChange: true,
  },
  gridOptions: {
    columns: [
      { field: 'id', title: '用户 ID', width: 110 },
      { field: 'name', title: '用户姓名', width: 160 },
      { field: 'tel', title: '电话', width: 150 },
      { field: 'email', minWidth: 220, title: '邮箱' },
      {
        field: 'enabled',
        slots: { default: 'userStatus' },
        title: '状态',
        width: 90,
      },
      {
        align: 'center',
        cellRender: {
          attrs: {
            nameField: 'name',
            nameTitle: '用户',
            onClick: onActionClick,
          },
          name: 'CellOperation',
          options: [{ code: 'remove', text: '移除' }],
        },
        field: 'operation',
        fixed: 'right',
        title: '操作',
        width: 100,
      },
    ],
    height: 'auto',
    keepSource: true,
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          if (!role.value) return { items: [], total: 0 };
          return SystemRoleApi.users(role.value.id, {
            keyword: String(formValues.keyword ?? '').trim() || undefined,
            page: page.currentPage,
            pageSize: page.pageSize,
            status:
              formValues.status === undefined
                ? undefined
                : (Number(formValues.status) as StatusValue),
          });
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
  } as VxeTableGridOptions<RoleUser>,
});

const [Drawer, drawerApi] = useVbenDrawer<SystemRole>({
  async onOpenChange(isOpen) {
    if (!isOpen) return;
    role.value = drawerApi.getData();
    await gridApi.query();
  },
});

function onActionClick(event: OnActionClickParams<RoleUser>) {
  if (event.code === 'remove') removeUser(event.row);
}

async function loadCandidates(keyword = '') {
  candidateLoading.value = true;
  try {
    const result = await SystemUserApi.options({
      keyword: keyword.trim() || undefined,
      page: 1,
      pageSize: 50,
    });
    candidates.value = result.items;
  } finally {
    candidateLoading.value = false;
  }
}

async function openAdd() {
  selectedUid.value = undefined;
  addOpen.value = true;
  await loadCandidates();
}

async function submitAdd() {
  if (!role.value || !selectedUid.value) {
    message.warning('请选择用户');
    return;
  }
  addLoading.value = true;
  try {
    await SystemRoleApi.addUser(role.value.id, selectedUid.value);
    message.success('角色授权已添加');
    addOpen.value = false;
    await gridApi.query();
  } finally {
    addLoading.value = false;
  }
}

function removeUser(user: RoleUser) {
  const currentRole = role.value;
  if (!currentRole) return;
  Modal.confirm({
    content: `确定移除用户“${user.name}”的“${currentRole.name}”角色授权吗？`,
    async onOk() {
      await SystemRoleApi.removeUser(currentRole.id, user.id);
      message.success('角色授权已移除');
      await gridApi.query();
    },
    title: '移除角色授权',
  });
}
</script>

<template>
  <Drawer
    class="w-full max-w-300"
    :footer="false"
    :title="role ? `角色用户：${role.name}` : '角色用户'"
  >
    <Grid>
      <template #toolbar-tools>
        <Button type="primary" @click="openAdd">添加用户</Button>
      </template>
      <template #userStatus="{ row }">
        <Tag :color="row.enabled ? 'success' : 'default'">
          {{ row.enabled ? '启用' : '停用' }}
        </Tag>
      </template>
    </Grid>

    <Modal
      v-model:open="addOpen"
      :confirm-loading="addLoading"
      title="添加角色用户"
      @cancel="addOpen = false"
      @ok="submitAdd"
    >
      <Select
        v-model:value="selectedUid"
        class="w-full"
        :filter-option="false"
        :loading="candidateLoading"
        :options="
          candidates.map((candidate) => ({
            label: `${candidate.name}（${candidate.id}）`,
            value: candidate.id,
          }))
        "
        placeholder="搜索并选择用户"
        show-search
        @search="loadCandidates"
      />
      <div class="mt-3 text-sm text-gray-500">已授权用户不会重复添加</div>
    </Modal>
  </Drawer>
</template>
