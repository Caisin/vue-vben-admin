<script setup lang="ts">
import type {
  RoleAccess,
  RoleMember,
  RolePermission,
  UserCandidate,
} from '#/api/vestige';

import { onBeforeUnmount, ref, watch } from 'vue';

import { Alert, Button, message, Modal, Select, Table, Tag } from 'antdv-next';

import { VestigeApi } from '#/api/vestige';
import { requestErrorMessage } from '#/request-errors';

import { permissionLabels } from './access';
import CandidatePicker from './candidate-picker.vue';
import { useRoleConfirmation } from './confirmation';

const props = defineProps<{ access: RoleAccess }>();
const emit = defineEmits<{ refresh: [] }>();
const rows = ref<RoleMember[]>([]);
const busy = ref(false);
const errorText = ref('');
const after = ref<string>();
const history = ref<(string | undefined)[]>([]);
const more = ref(false);
const picker = ref(false);
const editor = ref(false);
const target = ref<UserCandidate>();
const permission = ref<Exclude<RolePermission, 'owner'>>('viewer');
const saving = ref(false);
let generation = 0;
const confirm = useRoleConfirmation(() => [
  props.access.role.id,
  props.access.permission,
]);
const choices = [
  { value: 'viewer', label: '只读：检索知识和已发布规则' },
  { value: 'contributor', label: '贡献：上传素材、提交候选和复习反馈' },
  { value: 'publisher', label: '发布：采纳规则、编辑和整理记忆' },
];
async function load(reset = false) {
  if (reset) {
    after.value = undefined;
    history.value = [];
  }
  const current = ++generation;
  rows.value = [];
  if (props.access.permission !== 'owner') return;
  busy.value = true;
  errorText.value = '';
  try {
    const result = await VestigeApi.members(props.access.role.id, after.value);
    if (current !== generation) return;
    more.value = result.length > 25;
    rows.value = result.slice(0, 25);
  } catch (error) {
    if (current === generation) {
      errorText.value = requestErrorMessage(error, '共享成员加载失败');
      emit('refresh');
    }
  } finally {
    if (current === generation) busy.value = false;
  }
}
function edit(
  user: UserCandidate,
  grant: Exclude<RolePermission, 'owner'> = 'viewer',
) {
  target.value = user;
  permission.value = grant;
  editor.value = true;
}
async function save() {
  if (!target.value || props.access.permission !== 'owner' || saving.value)
    return;
  const role = props.access.role.id;
  saving.value = true;
  try {
    await VestigeApi.grant(role, target.value.user_id, permission.value);
    if (role !== props.access.role.id) return;
    editor.value = false;
    message.success('共享权限已保存');
    await load(true);
  } catch (error) {
    message.error(requestErrorMessage(error, '共享权限保存失败'));
    emit('refresh');
  } finally {
    saving.value = false;
  }
}
function revoke(member: RoleMember) {
  const role = props.access.role.id;
  confirm({
    cancelText: '取消',
    title: `撤销 ${member.name} 对 ${props.access.role.name} 的共享权限？`,
    content: '撤销后，该成员不能再通过此共享授权访问角色；已有知识仍保留。',
    okText: '撤销权限',
    okButtonProps: { danger: true },
    async onOk() {
      try {
        await VestigeApi.revoke(role, member.user_id);
        message.success('共享权限已撤销');
        if (role === props.access.role.id) await load();
      } catch (error) {
        message.error(requestErrorMessage(error, '撤销失败'));
        emit('refresh');
        throw error;
      }
    },
  });
}
function next() {
  history.value.push(after.value);
  after.value = rows.value.at(-1)?.user_id;
  void load();
}
function previous() {
  after.value = history.value.pop();
  void load();
}
watch(
  () => props.access.role.id,
  () => {
    generation++;
    editor.value = false;
    picker.value = false;
    void load(true);
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  generation++;
});
</script>
<template>
  <div class="mb-3 flex items-center justify-between gap-2">
    <p class="text-sm text-muted-foreground">
      共享成员操作同一个角色。账号和公司成员状态仍会影响实际访问。公司管理员的管理权由
      KX 单独控制。
    </p>
    <Button type="primary" :disabled="busy" @click="picker = true">
      添加成员
    </Button>
  </div>
  <Alert v-if="errorText" :message="errorText" type="error" class="mb-3" />
  <Table
    :data-source="rows"
    :loading="busy"
    row-key="user_id"
    :pagination="false"
    size="small"
    :scroll="{ x: 520 }"
    :columns="[
      { title: '成员', key: 'name', dataIndex: 'name' },
      { title: '登记权限', key: 'permission' },
      { title: '账号状态', key: 'enabled' },
      { title: '操作', key: 'actions', width: 140 },
    ]"
  >
    <template #bodyCell="{ column, record }">
      <template v-if="column.key === 'permission'">
        {{ permissionLabels[record.permission as RolePermission] }}
      </template>
      <Tag
        v-else-if="column.key === 'enabled'"
        :color="record.enabled ? 'green' : 'default'"
      >
        {{ record.enabled ? '启用' : '已停用' }}
      </Tag>
      <template v-else-if="column.key === 'actions'">
        <span
          v-if="record.permission === 'owner'"
          class="text-muted-foreground"
        >
          所有者
        </span>
        <template v-else>
          <Button
            type="link"
            size="small"
            @click="edit(record, record.permission)"
          >
            权限
          </Button>
          <Button type="link" size="small" danger @click="revoke(record)">
            撤销
          </Button>
        </template>
      </template>
    </template>
  </Table>
  <div class="mt-3 flex items-center justify-between">
    <Button :disabled="busy || history.length === 0" @click="previous">
      上一页
    </Button>
    <span>第 {{ history.length + 1 }} 页</span>
    <Button :disabled="busy || !more" @click="next">下一页</Button>
  </div>
  <CandidatePicker
    v-model:open="picker"
    :role-id="access.role.id"
    :private-role="!access.role.company_id"
    :exclude="access.role.owner_user_id"
    @select="edit"
  />
  <Modal
    v-model:open="editor"
    title="设置共享权限"
    :confirm-loading="saving"
    :closable="!saving"
    :keyboard="!saving"
    ok-text="保存权限"
    :mask-closable="!saving"
    @ok="save"
  >
    <p class="mb-3">{{ target?.name }}</p>
    <label
      :for="`vestige-permission-${access.role.id}`"
      class="mb-2 block font-medium"
    >
      共享权限
    </label>
    <Select
      :id="`vestige-permission-${access.role.id}`"
      v-model:value="permission"
      :disabled="saving"
      :options="choices"
      class="w-full"
    />
    <p class="mt-3 text-sm text-muted-foreground">
      发布者可修改现有记忆，请只授予信任的协作者。所有者身份不能通过此处转移。
    </p>
  </Modal>
</template>
