<script setup lang="ts">
import type {
  SyncOperation,
  SyncOperationItem,
  SyncSummary,
  SyncTarget,
} from '#/api/data-sync-operations';

import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useAccess } from '@vben/access';

import {
  Alert,
  Button,
  Input,
  Modal,
  Progress,
  Select,
  Space,
  Table,
  Tag,
} from 'antdv-next';

import { SyncOperationsApi } from '#/api/data-sync-operations';
import { requestErrorMessage } from '#/request-errors';
import { useTaskPolling } from '#/task-polling';

import {
  actionLabels,
  operationActive,
  operationProgress,
  operationStates,
  recoveryAdvice,
} from './operation-data';
const props = withDefaults(
  defineProps<{ targets?: SyncTarget[]; history?: boolean }>(),
  { targets: () => [], history: true },
);
const emit = defineEmits<{ finished: [] }>();
const route = useRoute();
const router = useRouter();
const { hasAccessByCodes } = useAccess();
const canOperate = computed(
  () =>
    hasAccessByCodes(['data-sync:configure']) ||
    hasAccessByCodes(['data-sync:execute']),
);
const open = ref(false);
const showHistory = ref(false);
const selected = ref<SyncTarget[]>([]);
const action = ref('sync');
const summaries = ref<SyncSummary[]>([]);
const errorText = ref('');
const busy = ref(false);
const preflightDone = ref(false);
const rejected = ref<Array<{ id: number; reason: string }>>([]);
const operation = ref<SyncOperation>();
const results = ref<SyncOperationItem[]>([]);
const records = ref<SyncOperation[]>([]);
const resultPage = ref(1);
const resultTotal = ref(0);
const resultState = ref<string>();
const keyword = ref('');
const historyPage = ref(1);
const historyTotal = ref(0);
let generation = 0;
let requestId = '';
let completedId: number | undefined;
const options = computed(() =>
  Object.entries(actionLabels)
    .filter(([a]) =>
      selected.value.every(
        (t) => t.kind === 'database' || !['confirm', 'discover'].includes(a),
      ),
    )
    .map(([value, label]) => ({ value, label })),
);
const executable = computed(() =>
  summaries.value.filter((s) =>
    s.actions.some((a) => a.action === action.value && a.allowed),
  ),
);
const denied = computed(() => [
  ...rejected.value,
  ...summaries.value
    .filter(
      (s) => !s.actions.some((a) => a.action === action.value && a.allowed),
    )
    .map((s) => ({
      id: s.id,
      reason:
        s.actions.find((a) => a.action === action.value)?.reason ||
        '当前状态不允许操作',
    })),
]);
function prepare(targets = props.targets, chosenAction?: string) {
  polling.stop();
  if (chosenAction) action.value = chosenAction;
  generation++;
  busy.value = false;
  selected.value = [...targets];
  summaries.value = [];
  rejected.value = [];
  preflightDone.value = false;
  requestId = crypto.randomUUID();
  operation.value = undefined;
  errorText.value = '';
  open.value = true;
}
watch(action, () => {
  generation++;
  summaries.value = [];
  preflightDone.value = false;
  rejected.value = [];
  requestId = crypto.randomUUID();
});
async function preflight() {
  const current = ++generation;
  const targets = [...selected.value];
  const chosen = action.value;
  busy.value = true;
  errorText.value = '';
  summaries.value = [];
  rejected.value = [];
  preflightDone.value = false;
  const accepted: SyncSummary[] = [];
  const failed: Array<{ id: number; reason: string }> = [];
  try {
    for (let offset = 0; offset < targets.length; offset += 200) {
      if (current !== generation) break;
      const chunk = targets.slice(offset, offset + 200);
      try {
        const r = await SyncOperationsApi.bulkPreflight(chunk, chosen);
        accepted.push(...r.items);
        failed.push(...r.rejected);
      } catch (error) {
        failed.push(
          ...chunk.map((t) => ({
            id: t.id,
            reason: requestErrorMessage(error, '预检失败'),
          })),
        );
      }
    }
    if (current !== generation) return;
    summaries.value = accepted;
    rejected.value = failed;
    preflightDone.value = true;
  } finally {
    if (current === generation) busy.value = false;
  }
}
async function submit() {
  if (!preflightDone.value || executable.value.length === 0 || busy.value)
    return;
  const current = ++generation;
  busy.value = true;
  errorText.value = '';
  try {
    const submitted = await SyncOperationsApi.submit(
      requestId,
      action.value,
      executable.value.map((s) => ({ kind: s.kind, id: s.id, stamp: s.stamp })),
    );
    if (current !== generation) return;
    operation.value = submitted;
    resultPage.value = 1;
    resultState.value = undefined;
    keyword.value = '';
    polling.start();
  } catch (error) {
    if (current !== generation) return;
    errorText.value = requestErrorMessage(
      error,
      '提交失败，可使用同一请求重试',
    );
  } finally {
    if (current === generation) busy.value = false;
  }
}
async function loadResults() {
  const id = operation.value?.id;
  if (!id) return;
  const query = {
    page: resultPage.value,
    size: 50,
    state: resultState.value,
    keyword: keyword.value,
  };
  const page = await SyncOperationsApi.items(id, query);
  if (
    operation.value?.id !== id ||
    query.page !== resultPage.value ||
    query.state !== resultState.value ||
    query.keyword !== keyword.value
  )
    return;
  results.value = page.items;
  resultTotal.value = page.total;
}
const polling = useTaskPolling({
  delay: 2000,
  load: async () => {
    const id = operation.value?.id;
    if (!id) throw new Error('没有操作记录');
    return SyncOperationsApi.get(id);
  },
  accept: async (op) => {
    if (operation.value?.id !== op.id) return;
    operation.value = op;
    errorText.value = '';
    await loadResults();
    if (!operationActive(op.state) && completedId !== op.id) {
      completedId = op.id;
      emit('finished');
    }
  },
  done: (op) => !operationActive(op.state),
  onError: (error) => {
    errorText.value = requestErrorMessage(error, '读取进度失败，正在重试');
  },
});
watch(open, (value) => {
  if (!value) {
    generation++;
    polling.stop();
  } else if (operation.value && operationActive(operation.value.state))
    polling.start();
});
watch(resultState, () => {
  resultPage.value = 1;
  void refreshResults();
});
async function refreshResults() {
  try {
    await loadResults();
    errorText.value = '';
  } catch (error) {
    errorText.value = requestErrorMessage(error, '结果加载失败');
  }
}
async function loadHistory() {
  showHistory.value = true;
  try {
    const r = await SyncOperationsApi.list({
      page: historyPage.value,
      size: 20,
    });
    records.value = r.items;
    historyTotal.value = r.total;
    errorText.value = '';
  } catch (error) {
    errorText.value = requestErrorMessage(error, '操作记录加载失败');
  }
}
async function view(id: number) {
  polling.stop();
  const current = ++generation;
  errorText.value = '';
  try {
    const result = await SyncOperationsApi.get(id);
    if (current !== generation) return;
    operation.value = result;
    resultPage.value = 1;
    resultState.value = undefined;
    keyword.value = '';
    open.value = true;
    await loadResults();
    if (operationActive(operation.value.state)) polling.start();
  } catch (error) {
    if (current !== generation) return;
    errorText.value = requestErrorMessage(
      error,
      '操作记录不可用或已按保留策略清理',
    );
  }
}
async function cancel() {
  const op = operation.value;
  if (!op) return;
  Modal.confirm({
    title: '停止后续批量操作？',
    content:
      '未开始的对象不再执行。已提交的子任务继续保留，可在对应对象中取消运行。',
    zIndex: 2800,
    onOk: async () => {
      await SyncOperationsApi.cancel(op.id);
      polling.start();
    },
  });
}
async function retryFailed() {
  if (!operation.value || busy.value) return;
  busy.value = true;
  try {
    const targets: SyncTarget[] = [];
    for (const state of ['failed', 'cancelled']) {
      let page = 1;
      do {
        const result = await SyncOperationsApi.items(operation.value.id, {
          page: page++,
          size: 200,
          state,
        });
        targets.push(
          ...result.items
            .filter(
              (i) => i.error_code !== 'data_sync_dispatch_outcome_unknown',
            )
            .map((i) => ({ kind: i.kind, id: i.object_id })),
        );
        if ((page - 1) * 200 >= result.total) break;
      } while (targets.length < 10_000);
    }
    action.value = operation.value.action;
    prepare(targets);
  } catch (error) {
    errorText.value = requestErrorMessage(error, '读取失败项失败');
  } finally {
    busy.value = false;
  }
}
async function exportResults() {
  const op = operation.value;
  if (!op || busy.value) return;
  busy.value = true;
  try {
    const rows: SyncOperationItem[] = [];
    let page = 1;
    do {
      const result = await SyncOperationsApi.items(op.id, {
        page: page++,
        size: 200,
        state: resultState.value,
        keyword: keyword.value,
      });
      rows.push(...result.items);
      if ((page - 1) * 200 >= result.total) break;
    } while (rows.length < 10_000);
    const blob = new Blob(
      [JSON.stringify({ operation: op, items: rows }, null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sync-operation-${op.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    errorText.value = requestErrorMessage(error, '导出结果失败');
  } finally {
    busy.value = false;
  }
}
function locate(item: SyncOperationItem) {
  open.value = false;
  showHistory.value = false;
  void router.push({
    path: '/data-sync/jobs',
    query:
      item.kind === 'database'
        ? { database_id: item.object_id }
        : { job_id: item.object_id },
  });
}
watch(
  () => route.query.operation_id,
  (id) => {
    if (props.history && Number(id) > 0) void view(Number(id));
  },
  { immediate: true },
);
defineExpose({ prepare, view });
</script>
<template>
  <Space>
    <Button v-if="canOperate && targets.length" @click="prepare()">
      操作预检（{{ targets.length }}）
    </Button>
    <Button
      v-if="history"
      @click="
        historyPage = 1;
        loadHistory();
      "
    >
      操作记录
    </Button>
  </Space>
  <Modal
    v-model:open="showHistory"
    title="同步操作记录"
    :width="1000"
    :footer="null"
    :z-index="2500"
  >
    <Alert
      type="info"
      message="已完成记录默认保留30天，每日清理；进行中和待核对记录继续保留。"
      class="mb-3"
    />
    <Alert v-if="errorText" type="error" :message="errorText" />
    <Table
      row-key="id"
      :data-source="records"
      :pagination="{ current: historyPage, pageSize: 20, total: historyTotal }"
      :columns="[
        { title: '操作', key: 'action' },
        { title: '状态', key: 'state' },
        { title: '对象数', dataIndex: 'total' },
        { title: '成功', dataIndex: 'succeeded' },
        { title: '未完成', dataIndex: 'failed' },
        { title: '详情', key: 'view' },
      ]"
      @change="
        (p) => {
          historyPage = p.current ?? 1;
          loadHistory();
        }
      "
    >
      <template #bodyCell="{ column, record }">
        <span v-if="column.key === 'action'">{{
          actionLabels[record.action]
        }}</span>
        <Tag v-else-if="column.key === 'state'">
          {{ operationStates[record.state] }}
        </Tag>
        <Button
          v-else-if="column.key === 'view'"
          type="link"
          @click="view(record.id)"
        >
          查看结果
        </Button>
      </template>
    </Table>
  </Modal>
  <Modal
    v-model:open="open"
    :title="operation ? '操作进度与结果' : '同步操作预检'"
    :width="1100"
    :footer="null"
    :z-index="2600"
    :mask-closable="!busy"
  >
    <Alert
      v-if="errorText"
      type="error"
      :message="errorText"
      class="mb-3"
      show-icon
    />
    <template v-if="!operation">
      <Space class="mb-3">
        <span>已选择 {{ selected.length }} 个对象</span><Select
          v-model:value="action"
          :options="options"
          :disabled="busy"
          style="width: 220px"
        /><Button
          :loading="busy"
          :disabled="!selected.length"
          @click="preflight"
        >
          检查可执行性
        </Button>
      </Space>
      <Alert
        type="info"
        :message="
          action === 'sync'
            ? '只同步一次，不恢复已暂停的调度；已暂停对象需先恢复。'
            : action === 'force_stop'
              ? '强制停止将暂停调度并撤销发布权，未确认批次保留待对账。'
              : '只执行选定动作；确认建表需要已检查的计划，结构变化后必须重新确认。'
        "
        class="mb-3"
      />
      <Alert
        v-if="preflightDone"
        :type="denied.length ? 'warning' : 'success'"
        :message="`${executable.length} 项可执行，${denied.length} 项不会提交`"
        class="mb-3"
      />
      <Table
        v-if="preflightDone"
        size="small"
        :data-source="summaries"
        :row-key="(r) => `${r.kind}:${r.id}`"
        :pagination="{ pageSize: 20 }"
        :columns="[
          { title: '对象', dataIndex: 'name' },
          { title: '目标', dataIndex: 'target' },
          { title: '状态', dataIndex: 'state' },
          { title: '待对账', dataIndex: 'pending_batches' },
          { title: '预检结果', key: 'reason' },
        ]"
      >
        <template #bodyCell="{ column, record }">
          <span v-if="column.key === 'reason'">{{
            record.actions.find(
              (a: { action: string; reason?: string | null }) =>
                a.action === action,
            )?.reason || '可执行'
          }}</span>
        </template>
      </Table>
      <Table
        v-if="rejected.length"
        :data-source="rejected"
        size="small"
        row-key="id"
        :columns="[
          { title: '对象编号', dataIndex: 'id' },
          { title: '预检失败', dataIndex: 'reason' },
        ]"
      />
      <Button
        type="primary"
        class="mt-4"
        :loading="busy"
        :disabled="!preflightDone || !executable.length"
        @click="submit"
      >
        确认{{ actionLabels[action] }}（{{ executable.length }}项）
      </Button>
    </template>
    <template v-else>
      <Space class="mb-3">
        <strong>{{ actionLabels[operation.action] }}</strong><Tag>{{ operationStates[operation.state] }}</Tag><span>成功 {{ operation.succeeded }} / 未完成 {{ operation.failed }} / 总计
          {{ operation.total }}</span>
      </Space>
      <Progress
        :percent="operationProgress(operation)"
        :status="
          operation.state === 'succeeded'
            ? 'success'
            : operation.state === 'failed'
              ? 'exception'
              : 'normal'
        "
      />
      <Alert
        v-if="operation.state === 'blocked'"
        type="warning"
        message="存在仍在执行、提交结果未知或待对账的对象。请定位对象核对运行及回执；不能直接重发。"
        class="mb-3"
      />
      <Space wrap class="mb-3">
        <Button @click="view(operation.id)">刷新进度</Button><Button
          v-if="canOperate && operationActive(operation.state)"
          danger
          @click="cancel"
        >
          停止后续操作
</Button><Button
          v-if="
            canOperate && !operationActive(operation.state) && operation.failed
          "
          @click="retryFailed"
        >
          重新预检未完成项
</Button><Button :loading="busy" @click="exportResults"> 导出筛选结果 </Button>
      </Space>
      <Space class="mb-3">
        <Input.Search
          v-model:value="keyword"
          placeholder="对象、目标或错误码"
          @search="
            resultPage = 1;
            refreshResults();
          "
        /><Select
          v-model:value="resultState"
          allow-clear
          placeholder="全部结果"
          :options="
            Object.entries(operationStates).map(([value, label]) => ({
              value,
              label,
            }))
          "
          style="width: 180px"
        />
      </Space>
      <Table
        size="small"
        row-key="id"
        :data-source="results"
        :pagination="{ current: resultPage, pageSize: 50, total: resultTotal }"
        :scroll="{ x: 950 }"
        :columns="[
          { title: '对象', key: 'target', width: 260 },
          { title: '状态', key: 'state', width: 120 },
          { title: '原因与下一步', key: 'error' },
          { title: '操作', key: 'locate', width: 100 },
        ]"
        @change="
          (p) => {
            resultPage = p.current ?? 1;
            refreshResults();
          }
        "
      >
        <template #bodyCell="{ column, record }">
          <div v-if="column.key === 'target'">
            {{ record.name || `对象 #${record.object_id}` }}
            <div>{{ record.target }}</div>
          </div>
          <Tag v-else-if="column.key === 'state'">
            {{ operationStates[record.state] }}
          </Tag>
          <div v-else-if="column.key === 'error'">
            {{ recoveryAdvice[record.error_code ?? ''] || record.error_code }}
            <div v-if="record.task_id" class="text-xs text-muted-foreground">
              执行编号：{{ record.task_id }}
            </div>
          </div>
          <Button
            v-else-if="column.key === 'locate'"
            type="link"
            @click="locate(record)"
          >
            定位对象
          </Button>
        </template>
      </Table>
    </template>
  </Modal>
</template>
