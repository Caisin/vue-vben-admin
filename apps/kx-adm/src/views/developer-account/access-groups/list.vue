<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  DeveloperAccountAccessGroup,
  DeveloperAccountAccessGroupWrite,
  DeveloperAccountListItem,
} from '#/api/developer-account';
import type { SystemUser } from '#/api/system/user';

import { computed, reactive, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';
import { IconifyIcon, Plus } from '@vben/icons';

import {
  Button,
  Drawer,
  Form,
  FormItem,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Select,
  Switch,
  Tag,
  Tooltip,
} from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { DeveloperAccountApi } from '#/api/developer-account';
import { SystemUserApi } from '#/api/system/user';

import { useColumns, useFormSchema } from './data';

const groupModalOpen = ref(false);
const { hasAccessByCodes } = useAccess();
const canManageAccess = computed(() =>
  hasAccessByCodes(['developer_account_access:manage']),
);
const relationDrawerOpen = ref(false);
const saving = ref(false);
const loadingRelations = ref(false);
const editing = ref<DeveloperAccountAccessGroup>();
const selectedGroup = ref<DeveloperAccountAccessGroup>();
const relationMode = ref<'accounts' | 'users'>('accounts');
const selectedAccountIds = ref<number[]>([]);
const selectedUids = ref<number[]>([]);
const accountOptions = ref<{ label: string; value: number }[]>([]);
const userOptions = ref<{ label: string; value: number }[]>([]);
const form = reactive<DeveloperAccountAccessGroupWrite>(emptyForm());

const [Grid, gridApi] = useVbenVxeGrid<DeveloperAccountAccessGroup>({
  formOptions: { schema: useFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async ({ page }, values) =>
          DeveloperAccountApi.accessGroups({
            enabled: values.enabled as boolean | undefined,
            keyword: String(values.keyword ?? '').trim() || undefined,
            page: page.currentPage,
            size: page.pageSize,
          }),
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
  } as VxeTableGridOptions<DeveloperAccountAccessGroup>,
});

const relationTitle = computed(() => {
  const action = relationMode.value === 'accounts' ? '分配账户' : '授权用户';
  return selectedGroup.value
    ? `${action}：${selectedGroup.value.grp_name}`
    : action;
});

function emptyForm(): DeveloperAccountAccessGroupWrite {
  return {
    enabled: true,
    grp_code: '',
    grp_name: '',
    order_no: 0,
    remark: '',
  };
}

function openCreate() {
  editing.value = undefined;
  Object.assign(form, emptyForm());
  groupModalOpen.value = true;
}

function openEdit(row: DeveloperAccountAccessGroup) {
  editing.value = row;
  Object.assign(form, {
    enabled: row.enabled,
    grp_code: row.grp_code,
    grp_name: row.grp_name,
    order_no: row.order_no,
    remark: row.remark,
  });
  groupModalOpen.value = true;
}

async function saveGroup() {
  if (!form.grp_name.trim() || !form.grp_code.trim()) {
    message.error('请输入分组名称和编码');
    return;
  }
  saving.value = true;
  try {
    await (editing.value
      ? DeveloperAccountApi.updateAccessGroup(editing.value.id, form)
      : DeveloperAccountApi.createAccessGroup(form));
    groupModalOpen.value = false;
    message.success('账户权限分组已保存');
    await gridApi.query();
  } finally {
    saving.value = false;
  }
}

async function removeGroup(row: DeveloperAccountAccessGroup) {
  await DeveloperAccountApi.removeAccessGroup(row.id);
  message.success('账户权限分组已删除');
  await gridApi.query();
}

async function openRelations(
  row: DeveloperAccountAccessGroup,
  mode: 'accounts' | 'users',
) {
  selectedGroup.value = row;
  relationMode.value = mode;
  relationDrawerOpen.value = true;
  loadingRelations.value = true;
  try {
    const accountsMode = mode === 'accounts';
    await (accountsMode ? loadAccountOptions() : loadUserOptions());
    const relation = await (accountsMode
      ? DeveloperAccountApi.accessGroupAccounts(row.id)
      : DeveloperAccountApi.accessGroupUsers(row.id));
    selectedAccountIds.value =
      'developer_account_ids' in relation ? relation.developer_account_ids : [];
    selectedUids.value = 'uids' in relation ? relation.uids : [];
  } finally {
    loadingRelations.value = false;
  }
}

async function saveRelations() {
  if (!selectedGroup.value) return;
  saving.value = true;
  try {
    await (relationMode.value === 'accounts'
      ? DeveloperAccountApi.replaceAccessGroupAccounts(
          selectedGroup.value.id,
          selectedAccountIds.value,
        )
      : DeveloperAccountApi.replaceAccessGroupUsers(
          selectedGroup.value.id,
          selectedUids.value,
        ));
    relationDrawerOpen.value = false;
    message.success(
      relationMode.value === 'accounts' ? '分组账户已更新' : '授权用户已更新',
    );
    await gridApi.query();
  } finally {
    saving.value = false;
  }
}

async function loadAccountOptions() {
  if (accountOptions.value.length > 0) return;
  const items: DeveloperAccountListItem[] = [];
  let page = 1;
  let total = Number.POSITIVE_INFINITY;
  while (items.length < total) {
    const result = await DeveloperAccountApi.list({ page, size: 100 });
    items.push(...result.items);
    total = result.total;
    if (result.items.length === 0) break;
    page += 1;
  }
  accountOptions.value = items.map((item) => ({
    label: `${item.account || '未录入账户'} · ${item.subject_name_cn || item.subject_name_en || '未关联主体'}`,
    value: Number(item.id),
  }));
}

async function loadUserOptions() {
  if (userOptions.value.length > 0) return;
  const items: SystemUser[] = [];
  let page = 1;
  let total = Number.POSITIVE_INFINITY;
  while (items.length < total) {
    const result = await SystemUserApi.options({ page, pageSize: 100 });
    items.push(...result.items);
    total = result.total;
    if (result.items.length === 0) break;
    page += 1;
  }
  userOptions.value = items.map((item) => ({
    label: `${item.name || item.id}（${item.id}）`,
    value: Number(item.id),
  }));
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <header class="page-heading">
      <h1>账户权限</h1>
    </header>

    <Grid class="management-grid" table-title="账户权限分组">
      <template #toolbar-tools>
        <Button v-if="canManageAccess" type="primary" @click="openCreate">
          <template #icon><Plus /></template>新增分组
        </Button>
      </template>
      <template #groupName="{ row }">
        <button
          v-if="canManageAccess"
          class="cell-action"
          type="button"
          @click="openEdit(row)"
        >
          {{ row.grp_name }}
        </button>
        <span v-else>{{ row.grp_name }}</span>
      </template>
      <template #accountCount="{ row }">
        <button
          class="cell-action"
          type="button"
          @click="openRelations(row, 'accounts')"
        >
          {{ row.account_count }} 个账户
        </button>
      </template>
      <template #userCount="{ row }">
        <button
          class="cell-action"
          type="button"
          @click="openRelations(row, 'users')"
        >
          {{ row.user_count }} 个用户
        </button>
      </template>
      <template #enabled="{ row }">
        <Tag :color="row.enabled ? 'success' : 'default'">
          {{ row.enabled ? '启用' : '停用' }}
        </Tag>
      </template>
      <template #remove="{ row }">
        <Popconfirm
          v-if="canManageAccess"
          :title="`确认删除账户权限分组 ${row.grp_name}？`"
          cancel-text="取消"
          ok-text="删除"
          @confirm="removeGroup(row)"
        >
          <Tooltip title="删除分组">
            <Button danger size="small" type="text">
              <template #icon>
                <IconifyIcon class="size-4" icon="lucide:trash-2" />
              </template>
            </Button>
          </Tooltip>
        </Popconfirm>
      </template>
    </Grid>

    <Modal
      v-model:open="groupModalOpen"
      :confirm-loading="saving"
      :title="editing ? '编辑账户权限分组' : '新增账户权限分组'"
      width="640px"
      @ok="saveGroup"
    >
      <Form layout="vertical">
        <div class="grid grid-cols-2 gap-x-4">
          <FormItem label="分组名称" required>
            <Input v-model:value="form.grp_name" />
          </FormItem>
          <FormItem label="分组编码" required>
            <Input v-model:value="form.grp_code" :disabled="Boolean(editing)" />
          </FormItem>
          <FormItem label="排序">
            <InputNumber
              v-model:value="form.order_no"
              class="w-full"
              :min="0"
            />
          </FormItem>
          <FormItem label="状态">
            <Switch
              v-model:checked="form.enabled"
              checked-children="启用"
              un-checked-children="停用"
            />
          </FormItem>
          <FormItem class="col-span-2" label="备注">
            <Input.TextArea v-model:value="form.remark" :rows="3" />
          </FormItem>
        </div>
      </Form>
    </Modal>

    <Drawer
      v-model:open="relationDrawerOpen"
      :loading="loadingRelations"
      :size="640"
      :title="relationTitle"
    >
      <Select
        v-if="relationMode === 'accounts'"
        v-model:value="selectedAccountIds"
        :disabled="!canManageAccess"
        class="w-full"
        mode="multiple"
        :options="accountOptions"
        placeholder="选择该分组包含的开发者账户"
        show-search
      />
      <Select
        v-else
        v-model:value="selectedUids"
        :disabled="!canManageAccess"
        class="w-full"
        mode="multiple"
        :options="userOptions"
        placeholder="选择可访问该分组账户的用户"
        show-search
      />
      <div class="mt-3 text-sm text-muted-foreground">
        已选择
        {{
          relationMode === 'accounts'
            ? selectedAccountIds.length
            : selectedUids.length
        }}
        项
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button @click="relationDrawerOpen = false">取消</Button>
          <Button
            v-if="canManageAccess"
            :loading="saving"
            type="primary"
            @click="saveRelations"
          >
            保存
          </Button>
        </div>
      </template>
    </Drawer>
  </Page>
</template>

<style scoped>
.cell-action {
  color: hsl(var(--primary));
  cursor: pointer;
}

.cell-action:hover {
  text-decoration: underline;
}
</style>
