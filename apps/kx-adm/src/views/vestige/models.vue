<script setup lang="ts">
import type { RoleAccess } from '#/api/vestige';
import type {
  ModelAction,
  ModelOperation,
  RoleModelState,
} from '#/api/vestige/models';

import { computed, onBeforeUnmount, ref, watch } from 'vue';

import {
  Alert,
  Button,
  Empty,
  message,
  Modal,
  Space,
  Spin,
  Table,
  Tag,
} from 'antdv-next';

import { ModelApi } from '#/api/vestige/models';
import { requestErrorMessage } from '#/request-errors';
import { useTaskPolling } from '#/task-polling';

const props = defineProps<{ access: RoleAccess }>();
const state = ref<RoleModelState>();
const errorText = ref('');
const actionError = ref('');
const loading = ref(false);
const submitting = ref(false);
let generation = 0;
let activationDialog: ReturnType<typeof Modal.confirm> | undefined;
const actionLabels: Record<ModelAction, string> = {
  model_install: '安装',
  model_evaluate: '兼容性评估',
  model_migrate: '语料迁移',
  model_activate: '激活模型',
};
const uncertain = new Map<string, string>();
const installedStates = new Set(['active', 'installed', 'ready']);
const activeStates = new Set(['queued', 'retrying', 'running']);
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
const labels: Record<string, string> = {
  active: '使用中',
  not_installed: '未安装',
  installing: '安装中',
  evaluating: '评估中',
  migrating: '迁移中',
  retryable_error: '可重试错误',
  repair_needed: '待修复',
  ready: '评估完成',
  installed: '已安装',
  failed: '不可用',
  inactive: '未启用',
};
const canManage = computed(
  () =>
    props.access.permission === 'owner' &&
    !errorText.value &&
    state.value?.canManage === true,
);
const activeName = computed(
  () =>
    state.value?.profiles.find(
      (p) => p.profile.profile_id === state.value?.active.active_profile_id,
    )?.profile.display_name ?? '加载中',
);
const rows = computed(() => {
  const data = state.value;
  if (!data) return [];
  const installed = new Map(
    data.profiles.map((p) => [p.profile.profile_id, p]),
  );
  const loaded = new Map(data.available.profiles.map((p) => [p.profile_id, p]));
  return [...new Set([...installed.keys(), ...loaded.keys()])].map((id) => {
    const model = installed.get(id);
    const available = loaded.get(id);
    return {
      id,
      model,
      available,
      name: model?.profile.display_name ?? available?.model_id ?? id,
      isActive: data.active.active_profile_id === id,
      busy: data.operations.some(
        (op) =>
          op.operation.profile_id === id &&
          op.task &&
          activeStates.has(op.task.status),
      ),
    };
  });
});
const polling = useTaskPolling({
  load: () => ModelApi.status(props.access.role.id),
  done: (value) =>
    !value.operations.some((op) => op.task && activeStates.has(op.task.status)),
  accept(value) {
    state.value = value;
    errorText.value = '';
    loading.value = false;
  },
  onError(error) {
    errorText.value = requestErrorMessage(error, '模型状态读取失败，请重试');
    loading.value = false;
    polling.stop();
  },
  delay: 2500,
});
function refresh() {
  loading.value = !state.value;
  polling.start();
}
watch(
  () => [props.access.role.id, props.access.permission],
  () => {
    generation++;
    activationDialog?.destroy();
    polling.stop();
    state.value = undefined;
    errorText.value = '';
    actionError.value = '';
    submitting.value = false;
    uncertain.clear();
    refresh();
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  activationDialog?.destroy();
  generation++;
  polling.stop();
});
async function submit(
  action: ModelAction,
  profile: string,
  request?: string,
  source?: string,
) {
  if (!canManage.value || submitting.value) return;
  const current = generation;
  const role = props.access.role.id;
  const expectedActive =
    action === 'model_migrate' || action === 'model_activate'
      ? (source ?? state.value?.active.active_profile_id)
      : undefined;
  const key = `${action}:${profile}:${expectedActive ?? ''}`;
  const requestKey = request ?? uncertain.get(key) ?? crypto.randomUUID();
  actionError.value = '';
  uncertain.set(key, requestKey);
  submitting.value = true;
  try {
    await ModelApi.submit(
      role,
      action,
      profile,
      requestKey,
      expectedActive,
      action === 'model_activate' ? true : undefined,
    );
    if (current !== generation) return;
    uncertain.delete(key);
    message.success('模型操作已进入任务队列');
    refresh();
  } catch (error) {
    if (current === generation) {
      actionError.value = requestErrorMessage(
        error,
        '提交未确认，再次点击会复用本次请求',
      );
      refresh();
    }
  } finally {
    if (current === generation) submitting.value = false;
  }
}
function confirmActivation(profile: string, name: string) {
  const current = generation;
  const source = state.value?.active.active_profile_id;
  if (!source || !canManage.value) return;
  activationDialog = Modal.confirm({
    title: '确认激活角色模型',
    content: `将“${props.access.role.name}”从 ${activeName.value} 切换到 ${name}。服务器会再次核对当前语料的完整向量覆盖。`,
    okText: '确认激活',
    cancelText: '暂不切换',
    onOk: async () => {
      if (current !== generation) return;
      await submit('model_activate', profile, undefined, source);
    },
  });
}
async function cancel(op: ModelOperation) {
  if (!canManage.value || !op.task || submitting.value) return;
  const current = generation;
  submitting.value = true;
  try {
    await ModelApi.cancel(props.access.role.id, op.task.id);
    if (current === generation) {
      message.success('已请求取消');
      refresh();
    }
  } catch (error) {
    if (current === generation)
      actionError.value = requestErrorMessage(error, '取消失败，请重试');
  } finally {
    if (current === generation) submitting.value = false;
  }
}
const percent = (value: null | number | undefined) =>
  value === null || value === undefined ? '—' : `${(value * 100).toFixed(1)}%`;
</script>
<template>
  <div class="model-panel">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 class="font-semibold">当前使用：{{ activeName }}</h3>
        <p class="text-muted-foreground text-sm">
          服务器加载模型后，需要为这个角色安装和评估。
        </p>
      </div>
      <Button :loading="loading" @click="refresh">刷新</Button>
    </div>
    <Alert
      type="info"
      show-icon
      message="迁移完成后，再确认激活新模型"
      description="兼容性评估不代表质量排名。迁移会保留进度；原文变化时需要重新迁移。安装、评估和迁移均不自动切换当前模型。"
    />
    <Alert
      v-if="state && !state.migrationAvailable"
      type="warning"
      show-icon
      message="请先在角色信息中升级数据结构，再迁移或激活模型。"
    />
    <Alert
      v-if="errorText || actionError"
      type="error"
      show-icon
      :message="actionError || errorText"
    />
    <Spin :spinning="loading">
      <Table
        v-if="rows.length"
        :data-source="rows"
        :pagination="false"
        row-key="id"
        :scroll="{ x: 650 }"
        :columns="[
          { title: '模型', key: 'model' },
          { title: '角色状态', key: 'state' },
          { title: '角色向量', key: 'vectors' },
          { title: '操作', key: 'actions' },
        ]"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'model'">
            <div>{{ record.name }}</div>
            <div class="text-muted-foreground break-all text-xs">
              {{ record.id }}
            </div>
          </template>
          <template v-else-if="column.key === 'state'">
            <Tag :color="record.isActive ? 'green' : 'default'">
              {{
                record.isActive
                  ? '使用中'
                  : record.model
                    ? record.model.state === 'ready' && !record.model.evaluation
                      ? '已保留'
                      : (labels[record.model.state] ?? record.model.state)
                    : '未安装'
              }}
            </Tag>
            <div class="text-muted-foreground text-xs">
              {{
                record.available
                  ? '服务器已加载'
                  : record.id === 'nomic-v1.5-legacy-raw-256' &&
                      state?.available.legacy_nomic_ready
                    ? '服务器已加载'
                    : '服务器未加载运行器'
              }}
            </div>
          </template>
          <template v-else-if="column.key === 'vectors'">
            <span v-if="record.model">
              已存 {{ record.model.vectorCount }} · 待补
              {{ record.model.missingVectors }}
            </span>
            <span v-else>—</span>
          </template>
          <template v-else-if="column.key === 'actions'">
            <Space v-if="canManage">
              <Button
                v-if="
                  record.available &&
                  (!record.model || !installedStates.has(record.model.state))
                "
                size="small"
                :disabled="record.busy || submitting"
                @click="submit('model_install', record.id)"
              >
                安装到角色
              </Button>
              <Button
                v-if="
                  record.available &&
                  record.model &&
                  installedStates.has(record.model.state)
                "
                size="small"
                :disabled="record.busy || submitting"
                @click="submit('model_evaluate', record.id)"
              >
                兼容性评估
              </Button>
              <Button
                v-if="
                  record.available &&
                  record.model?.state === 'ready' &&
                  !record.isActive
                "
                size="small"
                :disabled="
                  submitting ||
                  record.busy ||
                  !state?.migrationAvailable ||
                  record.model.latestMigration?.state === 'running'
                "
                @click="submit('model_migrate', record.id)"
              >
                迁移角色语料
              </Button>
              <Button
                v-if="
                  record.available &&
                  record.model?.state === 'ready' &&
                  !record.isActive &&
                  record.model.hasCompletedMigration
                "
                type="primary"
                size="small"
                :disabled="
                  submitting ||
                  record.busy ||
                  !state?.migrationAvailable ||
                  record.model.missingVectors > 0 ||
                  (record.model.latestMigration &&
                    record.model.latestMigration.state !== 'completed')
                "
                @click="confirmActivation(record.id, record.name)"
              >
                激活此模型
              </Button>
              <span
                v-if="!record.available"
                class="text-muted-foreground text-xs"
              >
                {{
                  record.id === 'nomic-v1.5-legacy-raw-256' &&
                  state?.available.legacy_nomic_ready
                    ? '默认兼容配置'
                    : '需先由管理员加载模型'
                }}
              </span>
            </Space>
            <span v-else class="text-muted-foreground">只读</span>
          </template>
        </template>
      </Table>
      <Empty v-else-if="!loading" description="暂无模型状态" />
    </Spin>
    <h3 class="font-semibold">最近操作</h3>
    <Empty v-if="!state?.operations.length" description="还没有模型操作任务" />
    <div
      v-for="op in state?.operations"
      :key="op.requestKey"
      class="rounded-lg border p-4"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <strong class="break-all">
          {{ actionLabels[op.operation.kind] }} ·
          {{ op.operation.profile_id }}
        </strong>
        <Tag>
          {{
            op.result
              ? '已提交'
              : op.migration?.state === 'invalidated'
                ? '语料已变化，请重新迁移'
                : op.migration?.state === 'cancelled'
                  ? '迁移已取消'
                  : op.task
                    ? (taskLabels[op.task.status] ?? op.task.status)
                    : '等待派发'
          }}
        </Tag>
      </div>
      <p v-if="op.migration" class="my-2 text-sm">
        已提交 {{ op.migration.completed }} / {{ op.migration.total }} 条语料
      </p>
      <p v-if="op.task" class="my-2 text-sm">
        {{ op.task.error_message || op.task.message }}
      </p>
      <p v-if="op.result?.evaluation" class="my-2 text-sm">
        公开样例 {{ op.result.evaluation.corpus_size }} 条 · Recall@5
        {{ percent(op.result.evaluation.recall_at_5) }} · nDCG@10
        {{ percent(op.result.evaluation.ndcg_at_10) }}
      </p>
      <Space v-if="canManage">
        <Button
          v-if="
            op.task &&
            (activeStates.has(op.task.status) ||
              op.migration?.state === 'running')
          "
          size="small"
          :disabled="submitting"
          @click="cancel(op)"
        >
          取消任务
        </Button>
        <Button
          v-if="
            op.canRetry &&
            !op.result &&
            (!op.task || !activeStates.has(op.task.status))
          "
          size="small"
          :disabled="submitting"
          @click="
            submit(
              op.operation.kind,
              op.operation.profile_id,
              op.requestKey,
              op.operation.expected_active,
            )
          "
        >
          重试本次操作
        </Button>
      </Space>
    </div>
  </div>
</template>
<style scoped>
.model-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  min-width: 0;
}
</style>
