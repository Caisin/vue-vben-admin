<script setup lang="ts">
import type {
  AssignmentConfig,
  AssignmentOrganization,
  AssignmentRole,
  AssignmentScope,
} from '#/api/system/role-assignment';

import { computed, onMounted, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';

import {
  Button,
  Checkbox,
  Input,
  message,
  Modal,
  Select,
  Table,
  Tag,
  Tree,
} from 'antdv-next';

import { RoleAssignmentApi } from '#/api/system/role-assignment';
import { requestErrorMessage } from '#/request-errors';

const { hasAccessByCodes } = useAccess();
const canConfigure = computed(() =>
  hasAccessByCodes(['roles:configure-distribution']),
);
const rows = ref<AssignmentConfig[]>([]);
const roles = ref<AssignmentRole[]>([]);
const loading = ref(false);
const loadingRoles = ref(false);
const rolesReady = ref(false);
const keyword = ref('');
const configuredOnly = ref(false);
const page = ref(1);
const size = ref(20);
const total = ref(0);
const editing = ref<AssignmentConfig>();
const selected = ref<string[]>([]);
const expected = ref<string[]>([]);
const organizations = ref<AssignmentOrganization[]>([]);
const scope = ref<AssignmentScope>({
  mode: 'managed',
  organization_keys: [],
  revision: 0,
});
const open = ref(false);
const saving = ref(false);
let requestId = 0;
const columns = [
  { dataIndex: 'name', key: 'name', title: '用户', width: 180 },
  { dataIndex: 'id', key: 'id', title: '用户 ID', width: 110 },
  { dataIndex: 'tel', key: 'tel', title: '电话', width: 150 },
  { key: 'roles', title: '可以分配的角色' },
  { key: 'scope', title: '可授权组织范围', width: 200 },
  { key: 'enabled', title: '用户状态', width: 100 },
];

async function load() {
  const request = ++requestId;
  loading.value = true;
  try {
    const result = await RoleAssignmentApi.configUsers({
      page: page.value,
      size: size.value,
      keyword: keyword.value.trim() || undefined,
      configured_only: configuredOnly.value,
    });
    if (request === requestId) {
      rows.value = result.items;
      total.value = result.total;
    }
  } catch (error) {
    if (request === requestId)
      message.error(requestErrorMessage(error, '角色分配配置加载失败'));
  } finally {
    if (request === requestId) loading.value = false;
  }
}
function search() {
  page.value = 1;
  void load();
}
function changePage(pagination: { current?: number; pageSize?: number }) {
  page.value = pagination.current ?? 1;
  size.value = pagination.pageSize ?? 20;
  void load();
}
async function edit(user: AssignmentConfig) {
  if (!canConfigure.value) return;
  editing.value = user;
  selected.value = user.roles.map((role) => role.role_id);
  expected.value = [...selected.value];
  scope.value = {
    ...(user.scope ?? { mode: 'managed', revision: 0 }),
    organization_keys: [...(user.scope?.organization_keys ?? [])],
  };
  open.value = true;
  rolesReady.value = false;
  roles.value = [];
  loadingRoles.value = true;
  try {
    const [roleOptions, organizationOptions] = await Promise.all([
      RoleAssignmentApi.configRoles(),
      RoleAssignmentApi.configOrganizations(),
    ]);
    roles.value = roleOptions;
    organizations.value = organizationOptions;
    rolesReady.value = true;
  } catch (error) {
    message.error(
      requestErrorMessage(error, '角色或组织范围加载失败，请重新打开'),
    );
  } finally {
    loadingRoles.value = false;
  }
}
async function save() {
  if (!editing.value || !canConfigure.value || !rolesReady.value) return;
  saving.value = true;
  try {
    await RoleAssignmentApi.saveConfig(
      editing.value.id,
      selected.value,
      expected.value,
      scope.value,
    );
    message.success('可分配角色和组织范围已保存');
    open.value = false;
    await load();
  } catch (error) {
    message.error(requestErrorMessage(error, '保存失败，请重试'));
  } finally {
    saving.value = false;
  }
}
function setScopeMode(value: unknown) {
  if (value !== 'all' && value !== 'managed' && value !== 'selected') return;
  scope.value.mode = value;
  scope.value.organization_keys = [];
}
function checkOrganizations(value: unknown) {
  const keys = Array.isArray(value)
    ? value
    : (value as { checked?: unknown })?.checked;
  if (Array.isArray(keys)) scope.value.organization_keys = keys.map(String);
}
function scopeLabel(value?: AssignmentScope) {
  if (value?.mode === 'all') return '全部组织及未分配用户';
  if (value?.mode === 'selected')
    return `指定组织（${value.organization_keys.length} 项）`;
  return '沿用组织管理范围';
}
onMounted(load);
</script>

<template>
  <Page
    title="角色分配配置"
    description="指定用户可分配的角色和可授权组织范围。配置不会给该用户授予这些角色本身。"
  >
    <div class="bg-card rounded-lg p-4">
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <Input
          v-model:value="keyword"
          class="!w-64"
          allow-clear
          placeholder="搜索用户姓名、ID、电话或邮箱"
          @press-enter="search"
        />
        <Checkbox v-model:checked="configuredOnly" @change="search">
          仅已配置用户
        </Checkbox>
        <Button :loading="loading" type="primary" @click="search">查询</Button>
        <Button :loading="loading" @click="load">刷新</Button>
      </div>
      <Table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="{
          current: page,
          pageSize: size,
          total,
          showSizeChanger: true,
        }"
        :row-key="(row: AssignmentConfig) => String(row.id)"
        :scroll="{ x: 780 }"
        size="small"
        @change="changePage"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <Button
              v-if="canConfigure"
              type="link"
              class="!p-0"
              :aria-label="`配置可分配角色：${record.name}`"
              @click="edit(record)"
            >
              {{ record.name }}
            </Button>
            <span v-else>{{ record.name }}</span>
          </template>
          <template v-else-if="column.key === 'roles'">
            <div class="flex flex-wrap gap-1">
              <Tag
                v-for="role in record.roles"
                :key="role.role_id"
                :color="role.enabled ? 'blue' : 'default'"
              >
                {{ role.role_name }}{{ role.enabled ? '' : '（停用）' }}
              </Tag>
              <span
                v-if="record.roles.length === 0"
                class="text-muted-foreground"
              >
                未配置
              </span>
            </div>
          </template>
          <span v-else-if="column.key === 'scope'">
            {{ scopeLabel(record.scope) }}
          </span>
          <Tag
            v-else-if="column.key === 'enabled'"
            :color="record.enabled ? 'success' : 'default'"
          >
            {{ record.enabled ? '启用' : '停用' }}
          </Tag>
        </template>
      </Table>
    </div>
    <Modal
      v-model:open="open"
      :title="`配置角色与组织范围：${editing?.name ?? ''}`"
      :width="720"
      :confirm-loading="saving"
      :ok-button-props="{ disabled: loadingRoles || !rolesReady }"
      :cancel-button-props="{ disabled: saving }"
      :closable="!saving"
      :mask-closable="false"
      @ok="save"
    >
      <div class="py-4">
        <label class="mb-2 block" for="distributable-roles">可分配角色</label>
        <Select
          id="distributable-roles"
          v-model:value="selected"
          class="w-full"
          mode="multiple"
          :loading="loadingRoles"
          :disabled="saving || loadingRoles"
          :options="
            roles.map((role) => ({
              value: role.role_id,
              label: `${role.role_name}（${role.role_id}）`,
              disabled: !role.enabled,
            }))
          "
          option-filter-prop="label"
          placeholder="选择允许分配的角色；清空可撤销分配范围"
        />
        <div class="mt-5">
          <div class="mb-2 flex items-center justify-between">
            <label for="assignment-scope-mode">可授权组织范围</label>
            <Checkbox
              :checked="scope.mode === 'all'"
              :disabled="saving || loadingRoles"
              @update:checked="
                (checked) => setScopeMode(checked ? 'all' : 'selected')
              "
            >
              全选
            </Checkbox>
          </div>
          <Select
            id="assignment-scope-mode"
            :value="scope.mode"
            class="w-full"
            :disabled="saving || loadingRoles"
            :options="[
              { label: '沿用组织管理范围', value: 'managed' },
              { label: '选择公司 / 部门', value: 'selected' },
              { label: '全部组织及未分配用户', value: 'all' },
            ]"
            @update:value="setScopeMode"
          />
          <div
            v-if="scope.mode === 'selected'"
            class="mt-3 max-h-64 overflow-auto rounded border p-2"
          >
            <Tree
              :tree-data="organizations"
              :checked-keys="scope.organization_keys"
              :disabled="saving || loadingRoles"
              checkable
              check-strictly
              :selectable="false"
              @check="checkOrganizations"
            />
            <p v-if="organizations.length === 0" class="text-muted-foreground">
              暂无可选组织
            </p>
          </div>
          <p class="text-muted-foreground mt-2 text-sm">
            选择公司或部门包含其下级；全选包含新增组织和未分配组织用户。此范围仅用于角色分配，不授予其他模块的组织管理权。管理员始终可分配全部组织用户。
          </p>
        </div>
        <p class="text-muted-foreground mt-3 text-sm">
          保存后，该用户可在“角色分配”给所配置范围内的其他用户添加角色，始终排除本人。清空可分配角色不会移除其他用户已经获得的角色。
        </p>
      </div>
    </Modal>
  </Page>
</template>
