<script setup lang="ts">
import type {
  AssignmentRole,
  AssignmentUser,
} from '#/api/system/role-assignment';

import { computed, onMounted, ref, watch } from 'vue';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Empty,
  Input,
  message,
  Modal,
  Popconfirm,
  Select,
  Table,
  Tag,
  Tooltip,
} from 'antdv-next';

import { RoleAssignmentApi } from '#/api/system/role-assignment';
import { requestErrorMessage } from '#/request-errors';

const { hasAccessByCodes } = useAccess();
const canWrite = computed(() => hasAccessByCodes(['roles:distribute']));
const roles = ref<AssignmentRole[]>([]);
const selectedRole = ref<string>();
const currentRole = computed(() =>
  roles.value.find((role) => role.role_id === selectedRole.value),
);
const loadingRoles = ref(false);
const loading = ref(false);
const rows = ref<AssignmentUser[]>([]);
const total = ref(0);
const page = ref(1);
const size = ref(20);
const keyword = ref('');
const addOpen = ref(false);
const candidates = ref<AssignmentUser[]>([]);
const candidateTotal = ref(0);
const candidatePage = ref(1);
const candidateSize = ref(20);
const candidateKeyword = ref('');
const loadingCandidates = ref(false);
const selectedUids = ref<string[]>([]);
const saving = ref(false);
let memberRequest = 0;
let candidateRequest = 0;

const userColumns = [
  { dataIndex: 'name', key: 'name', title: '用户', width: 160 },
  { dataIndex: 'id', key: 'id', title: '用户 ID', width: 110 },
  { dataIndex: 'tel', key: 'tel', title: '电话', width: 150 },
  { dataIndex: 'email', key: 'email', title: '邮箱' },
  { key: 'enabled', title: '状态', width: 90 },
];
const memberColumns = computed(() =>
  canWrite.value
    ? [...userColumns, { key: 'action', title: '操作', width: 70 }]
    : userColumns,
);
const selection = computed(() => ({
  selectedRowKeys: selectedUids.value,
  preserveSelectedRowKeys: true,
  onChange: (keys: Array<number | string>) => {
    selectedUids.value = keys.map(String);
  },
  getCheckboxProps: () => ({ disabled: saving.value }),
}));

async function refreshRoles() {
  loadingRoles.value = true;
  try {
    roles.value = await RoleAssignmentApi.roles();
    const next = roles.value.some((role) => role.role_id === selectedRole.value)
      ? selectedRole.value
      : roles.value[0]?.role_id;
    if (next === selectedRole.value) await loadMembers();
    else selectedRole.value = next;
  } catch (error) {
    message.error(requestErrorMessage(error, '可分配角色加载失败'));
  } finally {
    loadingRoles.value = false;
  }
}
async function loadMembers() {
  const role = selectedRole.value;
  const request = ++memberRequest;
  if (!role) {
    rows.value = [];
    total.value = 0;
    return;
  }
  loading.value = true;
  try {
    const result = await RoleAssignmentApi.members(role, {
      page: page.value,
      size: size.value,
      keyword: keyword.value.trim() || undefined,
    });
    if (request === memberRequest && role === selectedRole.value) {
      rows.value = result.items;
      total.value = result.total;
    }
  } catch (error) {
    if (request === memberRequest) {
      rows.value = [];
      total.value = 0;
      message.error(requestErrorMessage(error, '角色成员加载失败'));
    }
  } finally {
    if (request === memberRequest) loading.value = false;
  }
}
function searchMembers() {
  page.value = 1;
  void loadMembers();
}
function changeMembers(pagination: { current?: number; pageSize?: number }) {
  page.value = pagination.current ?? 1;
  size.value = pagination.pageSize ?? 20;
  void loadMembers();
}
async function loadCandidates() {
  const role = selectedRole.value;
  if (!role) return;
  const request = ++candidateRequest;
  loadingCandidates.value = true;
  try {
    const result = await RoleAssignmentApi.candidates(role, {
      page: candidatePage.value,
      size: candidateSize.value,
      keyword: candidateKeyword.value.trim() || undefined,
    });
    if (request === candidateRequest && role === selectedRole.value) {
      candidates.value = result.items;
      candidateTotal.value = result.total;
    }
  } catch (error) {
    if (request === candidateRequest) {
      candidates.value = [];
      candidateTotal.value = 0;
      message.error(requestErrorMessage(error, '可添加用户加载失败'));
    }
  } finally {
    if (request === candidateRequest) loadingCandidates.value = false;
  }
}
function searchCandidates() {
  candidatePage.value = 1;
  void loadCandidates();
}
function changeCandidates(pagination: { current?: number; pageSize?: number }) {
  candidatePage.value = pagination.current ?? 1;
  candidateSize.value = pagination.pageSize ?? 20;
  void loadCandidates();
}
async function openAdd() {
  if (!canWrite.value || !selectedRole.value) return;
  selectedUids.value = [];
  candidateKeyword.value = '';
  candidatePage.value = 1;
  candidates.value = [];
  candidateTotal.value = 0;
  addOpen.value = true;
  await loadCandidates();
}
async function add() {
  if (!canWrite.value || !selectedRole.value) return;
  if (selectedUids.value.length === 0 || selectedUids.value.length > 100) {
    message.warning('请选择 1 至 100 个用户');
    return;
  }
  saving.value = true;
  try {
    await RoleAssignmentApi.addMembers(selectedRole.value, selectedUids.value);
    message.success('角色成员已添加');
    addOpen.value = false;
    await loadMembers();
  } catch (error) {
    message.error(requestErrorMessage(error, '添加失败，请重试'));
  } finally {
    saving.value = false;
  }
}
async function remove(user: AssignmentUser) {
  if (!canWrite.value || !selectedRole.value) return;
  saving.value = true;
  try {
    await RoleAssignmentApi.removeMember(selectedRole.value, user.id);
    message.success('角色已从该用户移除');
    await loadMembers();
  } catch (error) {
    message.error(requestErrorMessage(error, '移除失败，请重试'));
  } finally {
    saving.value = false;
  }
}
watch(selectedRole, () => {
  page.value = 1;
  keyword.value = '';
  rows.value = [];
  total.value = 0;
  addOpen.value = false;
  selectedUids.value = [];
  ++candidateRequest;
  void loadMembers();
});
onMounted(refreshRoles);
</script>

<template>
  <Page
    title="角色分配"
    description="给组织管理范围内的其他用户添加角色。只能操作管理员允许你分配的角色。"
  >
    <div class="bg-card rounded-lg p-4">
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <label for="assignment-role">选择角色</label>
        <Select
          id="assignment-role"
          v-model:value="selectedRole"
          class="!w-72"
          :disabled="saving || addOpen"
          :loading="loadingRoles"
          :options="
            roles.map((role) => ({
              value: role.role_id,
              label: role.role_name,
            }))
          "
          placeholder="选择可以分配的角色"
          show-search
          option-filter-prop="label"
        />
        <Button
          :disabled="saving || addOpen"
          :loading="loadingRoles"
          @click="refreshRoles"
        >
          刷新角色
        </Button>
      </div>
      <template v-if="currentRole">
        <div class="mb-4 flex flex-wrap items-center gap-3">
          <Input
            v-model:value="keyword"
            class="!w-64"
            allow-clear
            placeholder="搜索角色成员"
            @press-enter="searchMembers"
          />
          <Button :loading="loading" @click="searchMembers">查询</Button>
          <Button
            v-if="canWrite"
            :disabled="saving"
            type="primary"
            @click="openAdd"
          >
            添加用户
          </Button>
          <span class="text-muted-foreground text-sm">
            {{ currentRole.role_name }} · 当前范围内 {{ total }} 人
          </span>
        </div>
        <Table
          :columns="memberColumns"
          :data-source="rows"
          :loading="loading"
          :pagination="{
            current: page,
            pageSize: size,
            total,
            showSizeChanger: true,
          }"
          :row-key="(row: AssignmentUser) => String(row.id)"
          :scroll="{ x: 650 }"
          size="small"
          @change="changeMembers"
        >
          <template #bodyCell="{ column, record }">
            <Tag
              v-if="column.key === 'enabled'"
              :color="record.enabled ? 'success' : 'default'"
            >
              {{ record.enabled ? '启用' : '停用' }}
            </Tag>
            <Popconfirm
              v-else-if="column.key === 'action'"
              :title="`移除 ${record.name} 的「${currentRole.role_name}」角色？`"
              :disabled="saving"
              @confirm="remove(record)"
            >
              <Tooltip title="移除角色">
                <Button
                  aria-label="移除角色"
                  danger
                  :disabled="saving"
                  size="small"
                  type="text"
                >
                  <IconifyIcon icon="lucide:user-minus" class="size-4" />
                </Button>
              </Tooltip>
            </Popconfirm>
          </template>
        </Table>
      </template>
      <Empty
        v-else-if="!loadingRoles"
        description="暂无可分配角色，请联系管理员在“角色分配配置”中配置"
      />
    </div>
    <Modal
      v-model:open="addOpen"
      :title="`添加用户到：${currentRole?.role_name ?? ''}`"
      width="850px"
      :confirm-loading="saving"
      :cancel-button-props="{ disabled: saving }"
      :ok-button-props="{
        disabled: loadingCandidates || selectedUids.length === 0,
      }"
      :closable="!saving"
      :mask-closable="false"
      @ok="add"
    >
      <div class="my-4 flex flex-wrap items-center gap-3">
        <Input
          v-model:value="candidateKeyword"
          class="!w-64"
          allow-clear
          placeholder="搜索姓名、ID、电话或邮箱"
          @press-enter="searchCandidates"
        />
        <Button
          :loading="loadingCandidates"
          :disabled="saving"
          @click="searchCandidates"
        >
          查询用户
        </Button>
        <span class="text-muted-foreground text-sm">
          已选 {{ selectedUids.length }} 人，最多 100 人；支持跨页选择
        </span>
      </div>
      <Table
        :columns="userColumns"
        :data-source="candidates"
        :loading="loadingCandidates"
        :pagination="{
          current: candidatePage,
          pageSize: candidateSize,
          total: candidateTotal,
          showSizeChanger: true,
        }"
        :row-key="(row: AssignmentUser) => String(row.id)"
        :row-selection="selection"
        :scroll="{ x: 600 }"
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
      <p class="text-muted-foreground mt-3 text-sm">
        仅显示组织管理范围内已启用、尚未拥有此角色的用户，不包含自己。
      </p>
    </Modal>
  </Page>
</template>
