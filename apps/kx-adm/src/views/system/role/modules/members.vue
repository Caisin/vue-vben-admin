<script setup lang="ts">
import type { SystemRole } from '#/api/system/role';
import type { AssignmentUser } from '#/api/system/role-assignment';

import { computed, ref, useId } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenDrawer } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import {
  Alert,
  Button,
  Input,
  message,
  Modal,
  Popconfirm,
  Select,
  Table,
  Tag,
} from 'antdv-next';

import { RoleAssignmentApi } from '#/api/system/role-assignment';
import { requestErrorMessage } from '#/request-errors';

const { hasAccessByCodes } = useAccess();
const userStore = useUserStore();
const statusInputId = useId();
const role = ref<SystemRole>();
const canAdd = computed(
  () =>
    role.value?.status === 1 &&
    [
      'api:auth.role_assignment.members.add',
      'api:auth.role_assignment.candidates',
    ].every((code) => hasAccessByCodes([code])),
);
const canRemove = computed(() =>
  hasAccessByCodes(['api:auth.role_assignment.members.remove']),
);
const isSelf = (user: AssignmentUser) =>
  String(user.id) === String(userStore.userInfo?.userId);
const rows = ref<AssignmentUser[]>([]);
const total = ref(0);
const page = ref(1);
const size = ref(20);
const keyword = ref('');
const enabled = ref<number>();
const enabledFilter = computed(() => {
  if (enabled.value === 1) return true;
  if (enabled.value === 0) return false;
  return undefined;
});
const loading = ref(false);
const loadError = ref('');
const saving = ref(false);
const addOpen = ref(false);
const candidates = ref<AssignmentUser[]>([]);
const candidateTotal = ref(0);
const candidatePage = ref(1);
const candidateSize = ref(20);
const candidateKeyword = ref('');
const candidateLoading = ref(false);
const candidateError = ref('');
const selectedIds = ref<string[]>([]);
let memberRequest = 0;
let candidateRequest = 0;
const columns = [
  { dataIndex: 'name', key: 'name', title: '用户姓名', width: 180 },
  { dataIndex: 'id', key: 'id', title: '用户 ID', width: 110 },
  { dataIndex: 'tel', key: 'tel', title: '电话', width: 160 },
  { dataIndex: 'email', key: 'email', title: '邮箱' },
  { key: 'enabled', title: '账号状态', width: 100 },
];
const memberColumns = computed(() =>
  canRemove.value
    ? [...columns, { key: 'action', title: '操作', width: 130 }]
    : columns,
);
const selection = computed(() => ({
  selectedRowKeys: selectedIds.value,
  preserveSelectedRowKeys: true,
  onChange: (keys: Array<number | string>) => {
    selectedIds.value = keys.map(String);
  },
  getCheckboxProps: (user: AssignmentUser) => ({
    disabled: saving.value || !user.enabled || isSelf(user),
  }),
}));
const [Drawer, drawerApi] = useVbenDrawer<SystemRole>({
  onBeforeClose: () => !saving.value,
  async onOpenChange(open) {
    ++memberRequest;
    ++candidateRequest;
    addOpen.value = false;
    selectedIds.value = [];
    if (!open) {
      role.value = undefined;
      return;
    }
    role.value = drawerApi.getData();
    rows.value = [];
    total.value = 0;
    page.value = 1;
    keyword.value = '';
    enabled.value = undefined;
    loadError.value = '';
    await loadMembers();
  },
});
async function loadMembers() {
  const current = role.value;
  if (!current) return;
  const request = ++memberRequest;
  loading.value = true;
  loadError.value = '';
  try {
    const result = await RoleAssignmentApi.members(current.id, {
      page: page.value,
      size: size.value,
      keyword: keyword.value.trim() || undefined,
      enabled: enabledFilter.value,
      include_self: true,
    });
    if (request !== memberRequest || role.value?.id !== current.id) return;
    const lastPage = Math.max(1, Math.ceil(result.total / size.value));
    if (page.value > lastPage) {
      page.value = lastPage;
      await loadMembers();
      return;
    }
    rows.value = result.items;
    total.value = result.total;
  } catch (error) {
    if (request === memberRequest) {
      rows.value = [];
      total.value = 0;
      loadError.value = requestErrorMessage(error, '成员加载失败，请重试');
    }
  } finally {
    if (request === memberRequest) loading.value = false;
  }
}
function resetMembers() {
  keyword.value = '';
  enabled.value = undefined;
  searchMembers();
}
function searchMembers() {
  page.value = 1;
  void loadMembers();
}
function changeMembers(value: { current?: number; pageSize?: number }) {
  page.value = value.current ?? 1;
  size.value = value.pageSize ?? 20;
  void loadMembers();
}
async function loadCandidates() {
  const current = role.value;
  if (!current) return;
  const request = ++candidateRequest;
  candidateLoading.value = true;
  candidateError.value = '';
  try {
    const result = await RoleAssignmentApi.candidates(current.id, {
      page: candidatePage.value,
      size: candidateSize.value,
      keyword: candidateKeyword.value.trim() || undefined,
    });
    if (request !== candidateRequest || role.value?.id !== current.id) return;
    candidates.value = result.items;
    candidateTotal.value = result.total;
  } catch (error) {
    if (request === candidateRequest) {
      candidates.value = [];
      candidateTotal.value = 0;
      candidateError.value = requestErrorMessage(
        error,
        '可添加用户加载失败，请重试',
      );
    }
  } finally {
    if (request === candidateRequest) candidateLoading.value = false;
  }
}
async function openAdd() {
  if (!canAdd.value || saving.value) return;
  selectedIds.value = [];
  candidateKeyword.value = '';
  candidatePage.value = 1;
  candidates.value = [];
  candidateTotal.value = 0;
  addOpen.value = true;
  await loadCandidates();
}
function searchCandidates() {
  candidatePage.value = 1;
  void loadCandidates();
}
function changeCandidates(value: { current?: number; pageSize?: number }) {
  candidatePage.value = value.current ?? 1;
  candidateSize.value = value.pageSize ?? 20;
  void loadCandidates();
}
async function addMembers() {
  const current = role.value;
  if (!current || !canAdd.value || saving.value) return;
  if (selectedIds.value.length === 0 || selectedIds.value.length > 100) {
    message.warning('请选择 1 至 100 个用户');
    return;
  }
  const ids = [...selectedIds.value];
  saving.value = true;
  try {
    await RoleAssignmentApi.addMembers(current.id, ids);
    message.success(`已为 ${ids.length} 个用户添加「${current.name}」角色`);
    addOpen.value = false;
    selectedIds.value = [];
    await loadMembers();
  } catch (error) {
    message.error(requestErrorMessage(error, '添加失败，请重试'));
  } finally {
    saving.value = false;
  }
}
async function removeMember(user: AssignmentUser) {
  const current = role.value;
  if (!current || !canRemove.value || isSelf(user) || saving.value) return;
  saving.value = true;
  try {
    await RoleAssignmentApi.removeMember(current.id, user.id);
    message.success(`已移除 ${user.name} 的「${current.name}」角色`);
    await loadMembers();
  } catch (error) {
    message.error(requestErrorMessage(error, '移除失败，请重试'));
  } finally {
    saving.value = false;
  }
}
</script>
<template>
  <Drawer
    class="w-screen max-w-none"
    :footer="false"
    :title="`角色成员：${role?.name ?? ''}`"
  >
    <Alert
      v-if="role?.status === 0"
      class="mb-4"
      type="warning"
      show-icon
      message="角色已停用，成员关系保留；可查看和移除成员，不能添加新成员。"
    />
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <Input
        v-model:value="keyword"
        class="!w-72"
        allow-clear
        placeholder="搜索姓名、ID、电话或邮箱"
        :disabled="saving"
        @press-enter="searchMembers"
      />
      <label :for="statusInputId">账号状态</label>
      <Select
        :id="statusInputId"
        v-model:value="enabled"
        class="!w-36"
        allow-clear
        placeholder="全部账号状态"
        :disabled="saving"
        :options="[
          { label: '启用', value: 1 },
          { label: '停用', value: 0 },
        ]"
        @change="searchMembers"
      />
      <Button :loading="loading" :disabled="saving" @click="searchMembers">
        查询成员
      </Button>
      <Button :disabled="saving" @click="resetMembers">重置筛选</Button>
      <Button :disabled="saving" @click="loadMembers">刷新</Button>
      <Button v-if="canAdd" type="primary" :disabled="saving" @click="openAdd">
        添加用户
      </Button>
      <span class="text-sm text-muted-foreground">
        当前可见成员 {{ total }} 人
      </span>
    </div>
    <Alert
      v-if="loadError"
      class="mb-4"
      type="error"
      show-icon
      :message="loadError"
    />
    <Table
      :columns="memberColumns"
      :data-source="rows"
      :loading="loading || saving"
      :pagination="{
        current: page,
        pageSize: size,
        total,
        showSizeChanger: true,
        disabled: saving,
      }"
      :row-key="(user: AssignmentUser) => String(user.id)"
      :scroll="{ x: 800 }"
      size="small"
      @change="changeMembers"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'name'">
          {{ record.name }}
          <Tag v-if="isSelf(record)">当前用户</Tag>
        </template>
        <Tag
          v-else-if="column.key === 'enabled'"
          :color="record.enabled ? 'success' : 'default'"
        >
          {{ record.enabled ? '启用' : '停用' }}
        </Tag>
        <template v-else-if="column.key === 'action'">
          <span v-if="isSelf(record)" class="text-muted-foreground">
            不可移除自己
          </span>
          <Popconfirm
            v-else
            :title="`移除 ${record.name} 的「${role?.name}」角色？`"
            :disabled="saving"
            :z-index="2200"
            @confirm="removeMember(record)"
          >
            <Button
              danger
              size="small"
              type="link"
              :disabled="saving"
              :aria-label="`移除角色成员：${record.name}`"
            >
              移除角色
            </Button>
          </Popconfirm>
        </template>
      </template>
    </Table>
    <p class="mt-3 text-sm text-muted-foreground">
      移除只解除当前角色，不删除用户及其其他角色。普通操作者只能维护获准角色和组织范围内的用户。
    </p>
    <Modal
      v-model:open="addOpen"
      :title="`添加用户到：${role?.name ?? ''}`"
      width="min(1000px, calc(100vw - 32px))"
      :z-index="2400"
      :confirm-loading="saving"
      :closable="!saving"
      :keyboard="!saving"
      :mask-closable="false"
      :cancel-button-props="{ disabled: saving }"
      :ok-button-props="{
        disabled:
          candidateLoading || !selectedIds.length || selectedIds.length > 100,
      }"
      @ok="addMembers"
    >
      <div class="my-4 flex flex-wrap items-center gap-3">
        <Input
          v-model:value="candidateKeyword"
          class="!w-72"
          allow-clear
          placeholder="搜索可添加用户"
          :disabled="saving"
          @press-enter="searchCandidates"
        />
        <Button
          :loading="candidateLoading"
          :disabled="saving"
          @click="searchCandidates"
        >
          查询用户
        </Button>
        <Button
          :disabled="saving || !selectedIds.length"
          @click="selectedIds = []"
        >
          清空选择
        </Button>
        <span>已选 {{ selectedIds.length }} 人，最多 100 人，支持跨页选择</span>
      </div>
      <Alert
        v-if="candidateError"
        class="mb-3"
        type="error"
        show-icon
        :message="candidateError"
      />
      <Table
        :columns="columns"
        :data-source="candidates"
        :loading="candidateLoading"
        :row-selection="selection"
        :pagination="{
          current: candidatePage,
          pageSize: candidateSize,
          total: candidateTotal,
          showSizeChanger: true,
          disabled: saving,
        }"
        :row-key="(user: AssignmentUser) => String(user.id)"
        :scroll="{ x: 650 }"
        size="small"
        @change="changeCandidates"
      >
        <template #bodyCell="{ column, record }">
          <Tag
            v-if="column.key === 'enabled'"
            :color="record.enabled ? 'success' : 'default'"
          >
            {{ record.enabled ? '启用' : '停用' }}
          </Tag>
        </template>
      </Table>
    </Modal>
  </Drawer>
</template>
