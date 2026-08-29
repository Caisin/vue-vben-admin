<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  TaskExecutor,
  TaskRun,
  TaskRunStatus,
  TaskSchedule,
  TaskScheduleDetail,
  TaskScheduleStatus,
  TaskScheduleWrite,
} from '#/api/task';

import { computed, onMounted, reactive, ref, watch } from 'vue';

import { Plus } from '@vben/icons';

import {
  Button,
  Input,
  InputNumber,
  message,
  Popconfirm,
  Select,
  Space,
  Tag,
} from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { TaskExecutorApi, TaskRunApi, TaskScheduleApi } from '#/api/task';
import { CronExpressionSelect } from '#/components/management';
import { displayValue } from '#/management';
import { Times } from '#/times';
import { vxeSortParams } from '#/vxe-sort';

import {
  misfirePolicyOptions,
  overlapPolicyOptions,
  scheduleColumns,
  scheduleStatusOptions,
  taskStatusColor,
  taskStatusLabel,
  useScheduleFormSchema,
} from './data';
import PopupDrawer from './modules/popup-drawer.vue';
import {
  buildPayloadFromFormValues,
  initialPayloadFormValues,
  payloadFieldsFromExecutor,
  suggestedBizKey,
  validatePayloadFormValues,
} from './schedule-payload';

const scheduleSortFields = [
  'id',
  'schedule_code',
  'executor_code',
  'next_fire_at',
  'last_fire_at',
  'updated_at',
  'created_at',
];

const executors = ref<TaskExecutor[]>([]);
const drawerOpen = ref(false);
const drawerSaving = ref(false);
const editingId = ref<number | string>();
const runDrawerOpen = ref(false);
const selectedSchedule = ref<TaskSchedule>();
const runs = ref<TaskRun[]>([]);
const runLoading = ref(false);
const executorLoading = ref(false);
const payloadForm = ref<Record<string, unknown>>({});
const originalParamsSignature = ref('');
let resettingForm = false;
let executorSchemaRequestId = 0;
const TEMPLATE_BIZ_KEY_PREFIX = '__template:';

const form = reactive<TaskScheduleWrite>({
  biz_key: 'global',
  cron_expr: '0 */5 * * * *',
  executor_code: '',
  instance_key: '',
  max_retries: 0,
  misfire_grace_seconds: 60,
  misfire_policy: 'fire_once',
  overlap_policy: 'wait',
  params: {},
  params_version: 1,
  retry_delay_seconds: 5,
  schedule_code: '',
  schedule_name: '',
  status: 'disabled',
  timeout_seconds: null,
  timezone_offset_seconds: 28_800,
});

const [Grid, gridApi] = useVbenVxeGrid<TaskSchedule>({
  formOptions: { schema: useScheduleFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: scheduleColumns(onStatusChange),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async (params, formValues) => {
          const { page } = params;
          const result = await TaskScheduleApi.list({
            executor_code:
              String(formValues.executor_code ?? '').trim() || undefined,
            page: page.currentPage,
            ...vxeSortParams(params, scheduleSortFields),
            size: page.pageSize,
            source: formValues.source || undefined,
            status: formValues.status as TaskScheduleStatus | undefined,
          });
          return { items: result.items, total: result.total };
        },
      },
    },
    rowConfig: { keyField: 'id' },
    sortConfig: { remote: true },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<TaskSchedule>,
});

const executorOptions = computed(() =>
  executors.value
    .filter((item) => item.allow_cron)
    .map((item) => ({
      disabled: !editingId.value && item.cardinality === 'singleton',
      label: `${item.display_name}（${item.executor_code}）`,
      value: item.executor_code,
    })),
);
const selectedExecutor = computed(() =>
  executors.value.find((item) => item.executor_code === form.executor_code),
);
const payloadFields = computed(() =>
  payloadFieldsFromExecutor(selectedExecutor.value),
);
const identitySummary = computed(
  () =>
    `${form.schedule_name || '未命名调度'} / ${form.executor_code || '未选择执行器'}`,
);

onMounted(async () => {
  executors.value = await TaskExecutorApi.list();
});

watch(
  () => form.executor_code,
  async (executorCode) => {
    if (resettingForm || !executorCode) return;
    form.biz_key = executorCode;
    form.params_version = selectedExecutor.value?.params_version ?? 1;
    await loadExecutorSchema(executorCode, {});
    resetPayloadForm({});
  },
);

watch(
  payloadForm,
  () => {
    if (resettingForm) return;
    const nextBizKey = suggestedBizKey(
      form.executor_code,
      payloadForm.value as Record<string, unknown>,
    );
    if (nextBizKey) {
      form.biz_key = nextBizKey;
    }
  },
  { deep: true },
);

function resetPayloadForm(params: unknown) {
  payloadForm.value = initialPayloadFormValues(payloadFields.value, params);
}

function payloadParams(params: unknown): Record<string, unknown> {
  if (params && typeof params === 'object' && !Array.isArray(params)) {
    return params as Record<string, unknown>;
  }
  return {};
}

function upsertExecutor(executor: TaskExecutor) {
  const index = executors.value.findIndex(
    (item) => item.executor_code === executor.executor_code,
  );
  if (index === -1) {
    executors.value.push(executor);
  } else {
    executors.value.splice(index, 1, executor);
  }
}

async function loadExecutorSchema(
  executorCode: string,
  params: Record<string, unknown>,
) {
  const requestId = ++executorSchemaRequestId;
  executorLoading.value = true;
  try {
    const executor = await TaskExecutorApi.schema(executorCode, { params });
    if (requestId === executorSchemaRequestId) {
      upsertExecutor(executor);
    }
    return executor;
  } finally {
    if (requestId === executorSchemaRequestId) {
      executorLoading.value = false;
    }
  }
}

function applyDetail(detail?: TaskScheduleDetail) {
  Object.assign(form, {
    biz_key: detail?.biz_key ?? 'global',
    cron_expr: detail?.cron_expr ?? '0 */5 * * * *',
    executor_code:
      detail?.executor_code ?? executors.value[0]?.executor_code ?? '',
    instance_key: detail?.instance_key ?? '',
    max_retries: Number(detail?.max_retries ?? 0),
    misfire_grace_seconds: Number(detail?.misfire_grace_seconds ?? 60),
    misfire_policy: detail?.misfire_policy ?? 'fire_once',
    overlap_policy: detail?.overlap_policy ?? 'wait',
    params: detail?.params ?? {},
    params_version:
      detail?.params_version ?? selectedExecutor.value?.params_version ?? 1,
    retry_delay_seconds: Number(detail?.retry_delay_seconds ?? 5),
    schedule_code: detail?.schedule_code ?? '',
    schedule_name: detail?.schedule_name ?? '',
    status: detail?.status ?? 'disabled',
    timeout_seconds:
      detail?.timeout_seconds === null || detail?.timeout_seconds === undefined
        ? null
        : Number(detail.timeout_seconds),
    timezone_offset_seconds: detail?.timezone_offset_seconds ?? 28_800,
  });
}

async function resetForm(row?: TaskSchedule) {
  resettingForm = true;
  editingId.value = row?.id;
  const detail = row ? await TaskScheduleApi.detail(row.id) : undefined;
  const params = detail?.params ?? {};
  applyDetail(detail);
  originalParamsSignature.value = JSON.stringify(params);
  try {
    if (form.executor_code) {
      await loadExecutorSchema(form.executor_code, payloadParams(params));
    }
    resetPayloadForm(params);
  } finally {
    resettingForm = false;
  }
}

async function createSchedule() {
  await resetForm();
  drawerOpen.value = true;
}

async function editSchedule(row: TaskSchedule) {
  await resetForm(row);
  drawerOpen.value = true;
}

async function saveSchedule() {
  const validationMessage = validatePayloadFormValues(
    payloadFields.value,
    payloadForm.value,
  );
  if (validationMessage) {
    message.warning(validationMessage);
    return;
  }
  if (!form.executor_code) {
    message.warning('请选择执行器');
    return;
  }
  if (!form.schedule_name.trim()) {
    message.warning('请填写调度名称');
    return;
  }

  drawerSaving.value = true;
  try {
    const params = buildPayloadFromFormValues(
      payloadFields.value,
      payloadForm.value,
    );
    form.params = params;
    form.params_version =
      selectedExecutor.value?.params_version ?? form.params_version;
    const nextBizKey = suggestedBizKey(form.executor_code, params);
    const paramsChanged =
      JSON.stringify(params) !== originalParamsSignature.value;
    if (
      nextBizKey &&
      (!form.biz_key.startsWith(TEMPLATE_BIZ_KEY_PREFIX) || paramsChanged)
    ) {
      form.biz_key = nextBizKey;
    }
    const payload: TaskScheduleWrite = { ...form };
    if (editingId.value) {
      await TaskScheduleApi.update(editingId.value, payload);
      message.success('调度配置已更新');
    } else {
      await TaskScheduleApi.create(payload);
      message.success('调度配置已创建');
    }
    drawerOpen.value = false;
    await gridApi.reload();
  } finally {
    drawerSaving.value = false;
  }
}

async function onStatusChange(status: TaskScheduleStatus, row: TaskSchedule) {
  if (status === 'enabled') {
    await TaskScheduleApi.enable(row.id);
    message.success('调度配置已启用');
  } else {
    await TaskScheduleApi.disable(row.id);
    message.success('调度配置已禁用');
  }
  return true;
}

async function triggerSchedule(row: TaskSchedule) {
  const result = await TaskScheduleApi.trigger(row.id);
  if (result.empty) {
    message.info(result.message || '本次扫描无待处理数据，未生成执行记录');
  } else {
    message.success(result.duplicate ? '已有执行在运行' : '已提前触发执行');
  }
  await gridApi.reload();
}

async function removeSchedule(row: TaskSchedule) {
  await TaskScheduleApi.remove(row.id);
  message.success('调度配置已删除');
  await gridApi.reload();
}

async function openRuns(row: TaskSchedule) {
  selectedSchedule.value = row;
  runDrawerOpen.value = true;
  runLoading.value = true;
  try {
    const page = await TaskRunApi.list({
      page: 1,
      schedule_id: row.id,
      size: 20,
    });
    runs.value = page.items;
  } finally {
    runLoading.value = false;
  }
}
</script>

<template>
  <Grid class="management-grid" table-title="调度配置">
    <template #toolbar-tools>
      <Button
        v-access:code="'tasks:schedule:manage'"
        type="primary"
        @click="createSchedule"
      >
        <Plus class="size-5" />新建调度
      </Button>
    </template>
    <template #scheduleOperation="{ row }">
      <Space>
        <Button
          v-access:code="'tasks:schedule:manage'"
          size="small"
          type="link"
          @click="editSchedule(row)"
        >
          编辑
        </Button>
        <Button size="small" type="link" @click="openRuns(row)">
          执行记录
        </Button>
        <Button
          v-access:code="'tasks:schedule:trigger'"
          size="small"
          type="link"
          @click="triggerSchedule(row)"
        >
          手动触发
        </Button>
        <Popconfirm
          v-if="row.source === 'user'"
          title="确认删除该用户调度配置？"
          @confirm="removeSchedule(row)"
        >
          <Button
            v-access:code="'tasks:schedule:manage'"
            danger
            size="small"
            type="link"
          >
            删除
          </Button>
        </Popconfirm>
      </Space>
    </template>
  </Grid>

  <PopupDrawer
    v-model:open="drawerOpen"
    destroy-on-close
    :title="editingId ? '调整调度配置' : '新建调度配置'"
    width="760"
  >
    <div class="schedule-form">
      <div class="full-row schedule-summary">
        <div>{{ identitySummary }}</div>
        <div class="muted-summary">
          手动触发相当于提前执行；不允许并发时，下一次 Cron 会等待当前执行结束。
        </div>
        <div v-if="selectedExecutor" class="muted-summary">
          {{ selectedExecutor.description || '无执行器说明' }}；最小间隔：{{
            selectedExecutor.minimum_interval_seconds
          }}
          秒；参数版本：{{ selectedExecutor.params_version }}
        </div>
      </div>
      <label>
        执行器<Select
          v-model:value="form.executor_code"
          :disabled="Boolean(editingId)"
          :options="executorOptions"
          show-search
        />
      </label>
      <label> 调度名称<Input v-model:value="form.schedule_name" /> </label>
      <label>
        调度编码<Input
          v-model:value="form.schedule_code"
          :disabled="Boolean(editingId)"
          placeholder="留空由后端生成"
        />
      </label>
      <label>
        实例键<Input
          v-model:value="form.instance_key"
          :disabled="Boolean(editingId)"
          placeholder="多实例调度用于区分参数实例"
        />
      </label>
      <label class="full-row">
        Cron 表达式
        <CronExpressionSelect
          v-model:value="form.cron_expr"
          v-model:timezone-offset-seconds="form.timezone_offset_seconds"
        />
      </label>
      <label>
        状态<Select
          v-model:value="form.status"
          :options="scheduleStatusOptions"
        />
      </label>
      <label> 业务键<Input v-model:value="form.biz_key" /> </label>
      <details class="full-row advanced-options">
        <summary>高级策略</summary>
        <div class="schedule-form nested-form">
          <label>
            重叠策略<Select
              v-model:value="form.overlap_policy"
              :options="overlapPolicyOptions"
            />
          </label>
          <label>
            Misfire 策略<Select
              v-model:value="form.misfire_policy"
              :options="misfirePolicyOptions"
            />
          </label>
          <label>
            Misfire 容差秒
            <InputNumber
              v-model:value="form.misfire_grace_seconds"
              class="w-full"
              :min="0"
            />
          </label>
          <label>
            最大重试次数
            <InputNumber
              v-model:value="form.max_retries"
              class="w-full"
              :min="0"
            />
          </label>
          <label>
            重试间隔秒
            <InputNumber
              v-model:value="form.retry_delay_seconds"
              class="w-full"
              :min="1"
            />
          </label>
          <label>
            超时秒
            <InputNumber
              v-model:value="form.timeout_seconds"
              class="w-full"
              :min="1"
            />
          </label>
        </div>
      </details>
      <div v-if="payloadFields.length" class="full-row section-title">
        任务参数
      </div>
      <template v-if="payloadFields.length">
        <label
          v-for="field in payloadFields"
          :key="field.name"
          :class="{ 'full-row': field.component === 'textarea' }"
        >
          <span>
            {{ field.label }}
            <span v-if="field.required" class="required-mark">*</span>
          </span>
          <Select
            v-if="field.component === 'select'"
            v-model:value="payloadForm[field.name]"
            allow-clear
            :loading="executorLoading"
            not-found-content="暂无可选项"
            :options="field.options"
            :placeholder="`选择${field.label}`"
            show-search
          />
          <InputNumber
            v-else-if="field.component === 'number'"
            v-model:value="payloadForm[field.name] as number | null | undefined"
            class="w-full"
            :max="field.maximum"
            :min="field.minimum"
          />
          <Select
            v-else-if="field.component === 'boolean'"
            v-model:value="payloadForm[field.name]"
            :options="[
              { label: '是', value: 'true' },
              { label: '否', value: 'false' },
            ]"
          />
          <textarea
            v-else-if="field.component === 'textarea'"
            v-model="payloadForm[field.name] as string"
            class="payload-textarea"
          ></textarea>
          <Input v-else v-model:value="payloadForm[field.name] as string" />
          <span v-if="field.help" class="muted-summary">{{ field.help }}</span>
        </label>
      </template>
      <div v-else class="full-row muted-summary">当前执行器无需额外参数</div>
    </div>
    <template #footer>
      <Space>
        <Button @click="drawerOpen = false">取消</Button>
        <Button :loading="drawerSaving" type="primary" @click="saveSchedule">
          保存
        </Button>
      </Space>
    </template>
  </PopupDrawer>

  <PopupDrawer
    v-model:open="runDrawerOpen"
    destroy-on-close
    :footer="false"
    :title="`执行记录 - ${displayValue(selectedSchedule?.schedule_name)}`"
    width="760"
  >
    <div v-if="runLoading">加载中...</div>
    <div v-else class="execution-list">
      <div v-for="item in runs" :key="item.id" class="execution-card">
        <div>
          #{{ item.id }}
          <Tag :color="taskStatusColor(item.status as TaskRunStatus)">
            {{ taskStatusLabel(item.status as TaskRunStatus) }}
          </Tag>
          · {{ Times.formatUnix(item.scheduled_at) }}
        </div>
        <div class="muted-summary">
          {{ item.trigger }} · 总 {{ displayValue(item.total_count) }} / 成功
          {{ item.succeeded_count }} / 失败 {{ item.failed_count }}
        </div>
        <div v-if="item.error_message" class="error-summary">
          {{ item.error_message }}
        </div>
      </div>
      <div v-if="runs.length === 0" class="muted-summary">暂无执行记录</div>
    </div>
  </PopupDrawer>
</template>

<style scoped>
.management-grid {
  flex: 1;
  min-height: 0;
}

.schedule-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.schedule-form label {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.schedule-summary {
  padding: 10px 12px;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.advanced-options {
  padding: 8px 0;
}

.advanced-options summary {
  cursor: pointer;
}

.nested-form {
  margin-top: 12px;
}

.section-title {
  font-weight: 600;
}

.full-row {
  grid-column: 1 / -1;
}

.payload-textarea {
  width: 100%;
  max-width: 100%;
  min-height: 160px;
  padding: 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.execution-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.execution-card {
  min-width: 0;
  padding: 10px;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.muted-summary {
  color: hsl(var(--muted-foreground));
  overflow-wrap: anywhere;
}

.required-mark,
.error-summary {
  color: hsl(var(--destructive));
}

@media (max-width: 960px) {
  .schedule-form {
    grid-template-columns: 1fr;
  }

  .execution-card :deep(.ant-space) {
    row-gap: 6px;
  }
}
</style>
