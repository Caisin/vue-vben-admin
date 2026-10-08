<script setup lang="ts">
import type {
  AssignmentConfig,
  AssignmentRole,
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
const open = ref(false);
const saving = ref(false);
let requestId = 0;
const columns = [
  { dataIndex: 'name', key: 'name', title: '用户', width: 180 },
  { dataIndex: 'id', key: 'id', title: '用户 ID', width: 110 },
  { dataIndex: 'tel', key: 'tel', title: '电话', width: 150 },
  { key: 'roles', title: '可以分配的角色' },
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
  open.value = true;
  rolesReady.value = false;
  roles.value = [];
  loadingRoles.value = true;
  try {
    roles.value = await RoleAssignmentApi.configRoles();
    rolesReady.value = true;
  } catch (error) {
    message.error(requestErrorMessage(error, '角色列表加载失败，请重新打开'));
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
    );
    message.success('可分配角色已保存');
    open.value = false;
    await load();
  } catch (error) {
    message.error(requestErrorMessage(error, '保存失败，请重试'));
  } finally {
    saving.value = false;
  }
}
onMounted(load);
</script>

<template>
  <Page
    title="角色分配配置"
    description="指定用户可以分配哪些角色。配置不会给该用户授予这些角色本身。"
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
      :title="`配置可分配角色：${editing?.name ?? ''}`"
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
        <p class="text-muted-foreground mt-3 text-sm">
          保存后，该用户刷新页面即可进入“角色分配”，给自己组织管理范围内的其他用户添加角色。清空不会移除已分配给其他人的角色。
        </p>
      </div>
    </Modal>
  </Page>
</template>
