<script setup lang="ts">
import type { TaskRun } from '#/api/task/run';
import type {
  CompanyOption,
  MemoryRole,
  RoleAccess,
  UserCandidate,
} from '#/api/vestige';

import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Descriptions,
  DescriptionsItem,
  Drawer,
  Empty,
  Input,
  message,
  Modal,
  Select,
  Spin,
  Table,
  TabPane,
  Tabs,
  Tag,
} from 'antdv-next';

import { VestigeApi } from '#/api/vestige';
import { requestErrorMessage } from '#/request-errors';
import { useTaskPolling } from '#/task-polling';

import { permissionLabels, statusLabels, useRoleAccess } from './access';
import CandidatePicker from './candidate-picker.vue';
import Members from './members.vue';
import RoleModels from './models.vue';
import WriterTraining from './writer/index.vue';

const rows = ref<MemoryRole[]>([]);
const busy = ref(false);
const errorText = ref('');
const after = ref<string>();
const history = ref<(string | undefined)[]>([]);
const more = ref(false);
let listGeneration = 0;
let createGeneration = 0;
const {
  id: selectedId,
  value: access,
  loading: detailLoading,
  error: detailError,
  select,
  clear,
  canManage,
  canCopy,
} = useRoleAccess();
const detailOpen = ref(false);
const detailTab = ref('overview');
const createOpen = ref(false);
const createName = ref('');
const createCompany = ref('');
const companies = ref<CompanyOption[]>([]);
const companyError = ref('');
const saving = ref(false);
const renameOpen = ref(false);
const renameName = ref('');
const renameRevision = ref(0);
const copyOpen = ref(false);
const copySource = ref<RoleAccess>();
const copyName = ref('');
const copyTarget = ref<UserCandidate>();
const pickerOpen = ref(false);
const task = ref<TaskRun>();
const taskRole = ref('');
const taskName = ref('');
const taskOpen = ref(false);
const taskError = ref('');
const finished = new Set<string>();
const activeStates = new Set(['queued', 'retrying', 'running']);
const taskActive = computed(
  () => !!task.value && activeStates.has(task.value.status),
);
const taskLabels: Record<string, string> = {
  queued: '排队中',
  running: '执行中',
  retrying: '重试中',
  succeeded: '已完成',
  failed: '失败',
  cancelled: '已取消',
  partially_succeeded: '部分完成',
  skipped: '已跳过',
};
const companyChoices = computed(() => [
  { value: '', label: '私人角色 · 自己使用或授权共享' },
  ...companies.value.map((c) => ({ value: c.id, label: c.name })),
]);
const taskPolling = useTaskPolling({
  load: async () => {
    const current = task.value;
    if (!current || !taskRole.value) throw new Error('没有可查询的角色任务');
    return VestigeApi.task(taskRole.value, current.id);
  },
  done: (run) => !activeStates.has(run.status),
  async accept(run) {
    task.value = run;
    taskError.value = '';
    const key = `${taskRole.value}:${run.id}`;
    if (activeStates.has(run.status) || finished.has(key)) return;
    finished.add(key);
    const completedRole = taskRole.value;
    if (run.status === 'succeeded') message.success(`${taskName.value}已完成`);
    await load();
    if (selectedId.value === completedRole) await select(completedRole);
  },
  onError(error) {
    taskError.value = requestErrorMessage(error, '任务状态查询失败，请重试');
    taskPolling.stop();
  },
});
async function load(reset = false) {
  if (reset) {
    after.value = undefined;
    history.value = [];
  }
  const current = ++listGeneration;
  busy.value = true;
  errorText.value = '';
  try {
    const data = await VestigeApi.roles(after.value);
    if (current !== listGeneration) return;
    more.value = data.length > 25;
    rows.value = data.slice(0, 25);
  } catch (error) {
    if (current === listGeneration) {
      rows.value = [];
      errorText.value = requestErrorMessage(
        error,
        '角色列表加载失败，请确认服务端已启用角色记忆',
      );
    }
  } finally {
    if (current === listGeneration) busy.value = false;
  }
}
function next() {
  history.value.push(after.value);
  after.value = rows.value.at(-1)?.id;
  void load();
}
function previous() {
  after.value = history.value.pop();
  void load();
}
async function openRole(role: MemoryRole) {
  detailTab.value = 'overview';
  renameOpen.value = false;
  detailOpen.value = true;
  await select(role.id);
}
function closeRole() {
  detailOpen.value = false;
  renameOpen.value = false;
  clear();
}
function refreshRole() {
  if (selectedId.value) void select(selectedId.value);
}
function track(role: MemoryRole, run: TaskRun, label: string) {
  taskPolling.stop();
  task.value = run;
  taskRole.value = role.id;
  taskName.value = `${role.name} · ${label}`;
  taskError.value = '';
  taskOpen.value = true;
  taskPolling.start();
}
async function openCreate() {
  const current = ++createGeneration;
  createOpen.value = true;
  createName.value = '';
  createCompany.value = '';
  companyError.value = '';
  companies.value = [];
  try {
    const data = await VestigeApi.companies();
    if (current === createGeneration && createOpen.value)
      companies.value = data;
  } catch (error) {
    if (current === createGeneration)
      companyError.value = requestErrorMessage(
        error,
        '公司列表暂不可用，仍可创建私人角色',
      );
  }
}
async function create() {
  if (saving.value || taskActive.value || !createName.value.trim()) return;
  saving.value = true;
  let created: MemoryRole | undefined;
  try {
    created = await VestigeApi.create(
      createName.value.trim(),
      createCompany.value,
    );
    createOpen.value = false;
    await load(true);
    await openRole(created);
    track(created, await VestigeApi.provision(created.id), '准备角色');
  } catch (error) {
    message.error(
      requestErrorMessage(
        error,
        created ? '角色已创建，但准备未成功，请在详情重试' : '创建角色失败',
      ),
    );
  } finally {
    saving.value = false;
  }
}
async function openDefault() {
  if (saving.value || taskActive.value) return;
  saving.value = true;
  try {
    const role = await VestigeApi.defaultRole();
    await load(true);
    await openRole(role);
    if (role.status === 'provisioning')
      track(role, await VestigeApi.provision(role.id), '准备默认角色');
  } catch (error) {
    message.error(requestErrorMessage(error, '默认角色加载失败'));
  } finally {
    saving.value = false;
  }
}
async function prepare() {
  const role = access.value?.role;
  if (!role || !access.value?.can_provision || saving.value || taskActive.value)
    return;
  saving.value = true;
  try {
    track(role, await VestigeApi.provision(role.id), '准备角色');
  } catch (error) {
    message.error(requestErrorMessage(error, '准备任务提交失败'));
    refreshRole();
  } finally {
    saving.value = false;
  }
}
async function upgrade() {
  const role = access.value?.role;
  if (!role || !canManage.value || saving.value || taskActive.value) return;
  saving.value = true;
  try {
    track(role, await VestigeApi.upgrade(role.id), '升级角色');
  } catch (error) {
    message.error(requestErrorMessage(error, '升级任务提交失败'));
    refreshRole();
  } finally {
    saving.value = false;
  }
}
function openRename() {
  if (!access.value || !canManage.value) return;
  renameName.value = access.value.role.name;
  renameRevision.value = access.value.role.revision;
  renameOpen.value = true;
}
async function rename() {
  const role = access.value?.role;
  if (!role || !canManage.value || saving.value || !renameName.value.trim())
    return;
  saving.value = true;
  try {
    await VestigeApi.rename(
      role.id,
      renameName.value.trim(),
      renameRevision.value,
    );
    renameOpen.value = false;
    message.success('名称已更新');
    await load();
    if (selectedId.value === role.id) await select(role.id);
  } catch (error) {
    message.error(
      requestErrorMessage(
        error,
        '修改失败；如名称已被他人更新，请关闭后重新打开编辑',
      ),
    );
    refreshRole();
  } finally {
    saving.value = false;
  }
}
async function openCopy() {
  const id = selectedId.value;
  if (!id || !canCopy.value) return;
  try {
    const current = await VestigeApi.access(id);
    if (id !== selectedId.value) return;
    if (!current.can_copy) throw new Error('当前没有公司角色复制权限');
    copySource.value = current;
    copyName.value = `${[...current.role.name].slice(0, 180).join('')}（副本）`;
    copyTarget.value = undefined;
    copyOpen.value = true;
  } catch (error) {
    message.error(requestErrorMessage(error, '无法复制角色'));
    refreshRole();
  }
}
async function copy() {
  const source = copySource.value;
  if (
    !source ||
    !copyTarget.value ||
    saving.value ||
    taskActive.value ||
    !copyName.value.trim()
  )
    return;
  saving.value = true;
  try {
    const copied = await VestigeApi.copy(
      source.role.id,
      copyName.value.trim(),
      copyTarget.value.user_id,
    );
    copyOpen.value = false;
    await load(true);
    await openRole(copied.role);
    track(copied.role, copied.task, '复制角色');
  } catch (error) {
    message.error(requestErrorMessage(error, '复制任务提交失败'));
  } finally {
    saving.value = false;
  }
}
onMounted(() => void load());
onBeforeUnmount(() => {
  listGeneration++;
  createGeneration++;
});
</script>
<template>
  <Page
    title="角色记忆"
    description="积累个人知识，与团队共同培养编剧角色，再把成熟角色交给新人继续使用。"
  >
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div class="flex gap-2">
        <Button
          type="primary"
          :disabled="saving || taskActive"
          @click="openCreate"
        >
          新建角色
        </Button>
        <Button :disabled="saving || taskActive" @click="openDefault">
          我的默认角色
        </Button>
      </div>
      <div class="flex gap-2">
        <Button v-if="task" @click="taskOpen = true">
          {{ taskActive ? '查看进行中的任务' : '查看最近操作' }}
        </Button>
        <Button :loading="busy" @click="load()">刷新列表</Button>
      </div>
    </div>
    <Alert
      v-if="errorText"
      :message="errorText"
      type="error"
      show-icon
      class="mb-4"
    />
    <Table
      :data-source="rows"
      :loading="busy"
      :pagination="false"
      row-key="id"
      :scroll="{ x: 660 }"
      :columns="[
        { title: '记忆角色', key: 'name', dataIndex: 'name' },
        { title: '归属', key: 'company' },
        { title: '状态', key: 'status' },
        { title: '最近更新', key: 'updated' },
      ]"
    >
      <template #bodyCell="{ column, record }">
        <Button
          v-if="column.key === 'name'"
          type="link"
          class="!px-0"
          @click="openRole(record)"
        >
          {{ record.name }}
        </Button>
        <template v-else-if="column.key === 'company'">
          {{
            record.company_id ? record.company_name || '公司角色' : '私人角色'
          }}
        </template>
        <Tag
          v-else-if="column.key === 'status'"
          :color="record.status === 'ready' ? 'green' : 'orange'"
        >
          {{ statusLabels[record.status] || record.status }}
        </Tag>
        <template v-else-if="column.key === 'updated'">
          {{ new Date(record.updated_at * 1000).toLocaleString('zh-CN') }}
        </template>
      </template>
      <template #emptyText>
        <Empty
          description="还没有可访问的角色。创建默认角色，开始积累自己的记忆。"
        />
      </template>
    </Table>
    <div class="mt-4 flex items-center justify-between">
      <Button :disabled="busy || history.length === 0" @click="previous">
        上一页
      </Button>
      <span class="text-muted-foreground">
        第 {{ history.length + 1 }} 页 · 每页最多 25 个角色
      </span>
      <Button :disabled="busy || !more" @click="next">下一页</Button>
    </div>

    <Drawer
      :open="detailOpen"
      :title="access?.role.name || '角色详情'"
      width="min(780px, 100vw)"
      @close="closeRole"
    >
      <Spin v-if="detailLoading" />
      <Alert
        v-else-if="detailError"
        :message="detailError"
        type="error"
        show-icon
      />
      <template v-else-if="access">
        <div class="mb-4 flex flex-wrap items-center gap-2">
          <Tag color="blue">{{ permissionLabels[access.permission] }}</Tag>
          <Tag>
            {{ statusLabels[access.role.status] || access.role.status }}
          </Tag>
          <Button size="small" @click="refreshRole">刷新详情</Button>
        </div>
        <Tabs v-model:active-key="detailTab">
          <TabPane key="overview" tab="角色信息">
            <Descriptions :column="1" bordered size="small">
              <DescriptionsItem label="名称">
                {{ access.role.name }}
              </DescriptionsItem>
              <DescriptionsItem label="归属">
                {{
                  access.role.company_id
                    ? access.role.company_name || '公司角色'
                    : '私人角色'
                }}
              </DescriptionsItem>
              <DescriptionsItem label="我的权限">
                {{ permissionLabels[access.permission] }}
              </DescriptionsItem>
              <DescriptionsItem v-if="access.role.description" label="说明">
                {{ access.role.description }}
              </DescriptionsItem>
              <DescriptionsItem label="角色标识">
                <span class="break-all font-mono text-xs">
                  {{ access.role.id }}
                </span>
              </DescriptionsItem>
            </Descriptions>
            <p class="my-4 text-muted-foreground">
              在本地客户端选择这个角色后，Agent
              即可在对应权限内检索知识、贡献素材与编剧规则。
            </p>
            <Alert
              v-if="access.role.status !== 'ready'"
              type="info"
              class="mb-4"
              message="角色的数据空间尚未就绪，准备完成后才能检索与培养。"
            />
            <div class="flex flex-wrap gap-2">
              <Button v-if="canManage" :disabled="saving" @click="openRename">
                修改名称
              </Button>
              <Button
                v-if="access.can_provision"
                type="primary"
                :disabled="saving || taskActive"
                @click="prepare"
              >
                准备角色 / 查看准备任务
              </Button>
              <Button
                v-if="canCopy"
                type="primary"
                :disabled="saving || taskActive"
                @click="openCopy"
              >
                复制给公司成员
              </Button>
            </div>
            <details
              v-if="canManage && access.role.status === 'ready'"
              class="mt-5"
            >
              <summary class="cursor-pointer text-muted-foreground">
                服务升级后的角色维护
              </summary>
              <p class="my-3 text-sm">
                服务端更新后，可升级这个角色的数据结构。已有知识、规则和项目会保留。
              </p>
              <Button :disabled="saving || taskActive" @click="upgrade">
                提交角色升级任务
              </Button>
            </details>
          </TabPane>
          <TabPane
            v-if="access.role.status === 'ready'"
            key="writer"
            tab="编剧培养"
          >
            <WriterTraining
              v-if="detailTab === 'writer'"
              :key="access.role.id"
              :access="access"
            />
          </TabPane>
          <TabPane
            v-if="access.role.status === 'ready'"
            key="models"
            tab="记忆模型"
          >
            <RoleModels
              v-if="detailTab === 'models'"
              :key="access.role.id"
              :access="access"
            />
          </TabPane>
          <TabPane v-if="canManage" key="members" tab="共享成员">
            <Members
              v-if="detailTab === 'members'"
              :key="access.role.id"
              :access="access"
              @refresh="refreshRole"
            />
          </TabPane>
        </Tabs>
      </template>
    </Drawer>

    <Modal
      v-model:open="createOpen"
      title="新建记忆角色"
      ok-text="创建并准备"
      :confirm-loading="saving"
      :closable="!saving"
      :mask-closable="!saving"
      :keyboard="!saving"
      :ok-button-props="{ disabled: !createName.trim() || taskActive }"
      @ok="create"
    >
      <div class="vestige-field">
        <label for="vestige-create-name">角色名称</label>
        <Input
          id="vestige-create-name"
          v-model:value="createName"
          :disabled="saving"
          :maxlength="200"
          placeholder="例如：悬疑短剧编剧"
        />
      </div>
      <div class="vestige-field">
        <label for="vestige-create-company">角色归属</label>
        <Select
          id="vestige-create-company"
          v-model:value="createCompany"
          :disabled="saving"
          :options="companyChoices"
        />
      </div>
      <Alert v-if="companyError" :message="companyError" type="warning" />
      <p class="mt-3 text-sm text-muted-foreground">
        私人角色默认仅自己可用。公司角色由有公司管理资格的用户创建，之后可共享或复制给公司成员。
      </p>
    </Modal>
    <Modal
      v-if="canManage"
      v-model:open="renameOpen"
      title="修改角色名称"
      ok-text="保存名称"
      :confirm-loading="saving"
      :closable="!saving"
      :mask-closable="!saving"
      :keyboard="!saving"
      :ok-button-props="{ disabled: !renameName.trim() }"
      @ok="rename"
    >
      <Input
        v-model:value="renameName"
        :disabled="saving"
        aria-label="角色名称"
        :maxlength="200"
      />
    </Modal>
    <Modal
      v-model:open="copyOpen"
      title="复制成熟角色给公司成员"
      ok-text="提交复制任务"
      :confirm-loading="saving"
      :closable="!saving"
      :mask-closable="!saving"
      :keyboard="!saving"
      :ok-button-props="{
        disabled: !copyName.trim() || !copyTarget || taskActive,
      }"
      @ok="copy"
    >
      <p class="mb-3">来源：{{ copySource?.role.name }}</p>
      <div class="vestige-field">
        <label for="vestige-copy-name">新角色名称</label>
        <Input
          id="vestige-copy-name"
          v-model:value="copyName"
          :disabled="saving"
          :maxlength="200"
        />
      </div>
      <div class="vestige-field">
        <span>接收成员</span>
        <div class="flex items-center gap-3">
          <span>{{ copyTarget?.name || '尚未选择' }}</span>
          <Button :disabled="saving" @click="pickerOpen = true">
            选择成员
          </Button>
        </div>
      </div>
      <Alert
        type="info"
        message="复制知识、学习状态、已发布规则及其作品和用户反馈证据。新旧角色独立演进；其他对话、项目稿件、授权和账号凭据不复制。"
      />
    </Modal>
    <CandidatePicker
      v-if="copySource"
      v-model:open="pickerOpen"
      :role-id="copySource.role.id"
      @select="copyTarget = $event"
    />
    <Modal
      v-model:open="taskOpen"
      :title="taskName || '角色任务'"
      :footer="null"
    >
      <template v-if="task">
        <Tag
          :color="
            task.status === 'succeeded'
              ? 'green'
              : task.status === 'failed'
                ? 'red'
                : 'blue'
          "
        >
          {{ taskLabels[task.status] || task.status }}
        </Tag>
        <p class="my-3">{{ task.message }}</p>
        <p class="my-3 text-sm text-muted-foreground">
          完成 {{ task.succeeded_count }} / {{ task.total_count ?? '—' }}，失败
          {{ task.failed_count }}
        </p>
        <p v-if="task.error_message" class="mb-3 text-red-500">
          {{ task.error_message }}
        </p>
        <Alert
          v-if="taskError"
          :message="taskError"
          type="error"
          class="mb-3"
        />
        <Button v-if="taskError" @click="taskPolling.start()">
          重新查询任务
        </Button>
        <p class="mt-3 text-sm text-muted-foreground">
          任务由服务端执行。结束后刷新列表与当前详情，角色状态以服务端数据为准。
        </p>
      </template>
    </Modal>
  </Page>
</template>
<style scoped>
.vestige-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 18px;
}

.vestige-field > label {
  font-weight: 500;
}
</style>
