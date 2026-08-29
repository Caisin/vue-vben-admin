import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type {
  TaskExecutorKind,
  TaskRun,
  TaskRunFilterExecutorOption,
  TaskRunStatus,
  TaskRunTrigger,
  TaskSchedule,
  TaskScheduleMisfirePolicy,
  TaskScheduleOverlapPolicy,
  TaskScheduleSource,
  TaskScheduleStatus,
} from '#/api/task';

import { Times } from '#/times';

export const taskStatusOptions: Array<{ label: string; value: TaskRunStatus }> =
  [
    { label: '排队中', value: 'queued' },
    { label: '执行中', value: 'running' },
    { label: '等待重试', value: 'retrying' },
    { label: '成功', value: 'succeeded' },
    { label: '部分成功', value: 'partially_succeeded' },
    { label: '失败', value: 'failed' },
    { label: '已取消', value: 'cancelled' },
    { label: '已跳过', value: 'skipped' },
  ];

export const taskTriggerOptions: Array<{
  label: string;
  value: TaskRunTrigger;
}> = [
  { label: '定时', value: 'cron' },
  { label: '手动', value: 'manual' },
  { label: '即时', value: 'dispatch' },
];

export const executorKindOptions: Array<{
  label: string;
  value: TaskExecutorKind;
}> = [
  { label: '业务内建', value: 'business' },
  { label: 'HTTP', value: 'http' },
  { label: 'Shell', value: 'shell' },
];

export function useTaskFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Select',
      componentProps: { allowClear: true, mode: 'combobox', showSearch: true },
      fieldName: 'executor_code',
      label: '执行编码',
    },
    {
      component: 'Select',
      componentProps: { allowClear: true, mode: 'combobox', showSearch: true },
      fieldName: 'biz_key',
      label: '业务键',
    },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: taskStatusOptions },
      fieldName: 'status',
      label: '运行状态',
    },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: taskTriggerOptions },
      fieldName: 'trigger',
      label: '触发来源',
    },
  ];
}

export function useTaskFormSchemaWithOptions(
  executorOptions: TaskRunFilterExecutorOption[],
  bizKeyOptions: string[],
): VbenFormSchema[] {
  return [
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        filterOption: true,
        mode: 'combobox',
        options: executorOptions.map((item) => ({
          label: `${item.display_name} (${item.executor_code})`,
          value: item.executor_code,
        })),
        showSearch: true,
      },
      fieldName: 'executor_code',
      label: '执行编码',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        filterOption: true,
        mode: 'combobox',
        options: bizKeyOptions.map((value) => ({ label: value, value })),
        showSearch: true,
      },
      fieldName: 'biz_key',
      label: '业务键',
    },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: taskStatusOptions },
      fieldName: 'status',
      label: '运行状态',
    },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: taskTriggerOptions },
      fieldName: 'trigger',
      label: '触发来源',
    },
  ];
}

export function taskStatusLabel(status: TaskRunStatus) {
  return (
    taskStatusOptions.find((item) => item.value === status)?.label ?? status
  );
}

export function taskStatusColor(status: TaskRunStatus) {
  const colors: Record<TaskRunStatus, string> = {
    cancelled: 'default',
    failed: 'error',
    partially_succeeded: 'warning',
    queued: 'warning',
    retrying: 'processing',
    running: 'processing',
    skipped: 'default',
    succeeded: 'success',
  };
  return colors[status];
}

export function taskTriggerLabel(trigger: TaskRunTrigger) {
  return (
    taskTriggerOptions.find((item) => item.value === trigger)?.label ?? trigger
  );
}

export function taskColumns(): VxeTableGridColumns<TaskRun> {
  return [
    {
      field: 'id',
      fixed: 'left',
      sortable: true,
      title: 'Run ID',
      width: 110,
    },
    {
      field: 'status',
      slots: { default: 'status' },
      title: '状态',
      width: 110,
    },
    {
      field: 'schedule_name',
      minWidth: 180,
      title: '调度配置',
    },
    {
      field: 'trigger',
      slots: { default: 'trigger' },
      title: '来源',
      width: 90,
    },
    {
      field: 'message',
      minWidth: 180,
      title: '阶段说明',
    },
    {
      field: 'total_count',
      slots: { default: 'progress' },
      title: '批量进度',
      width: 190,
    },
    {
      field: 'scheduled_at',
      slots: { default: 'times' },
      sortable: true,
      title: '时间',
      width: 280,
    },
    {
      field: 'error_message',
      minWidth: 240,
      slots: { default: 'error' },
      title: '错误摘要',
    },
    {
      field: 'operation',
      fixed: 'right',
      slots: { default: 'operation' },
      title: '操作',
      width: 160,
    },
  ];
}

export const scheduleStatusOptions: Array<{
  label: string;
  value: TaskScheduleStatus;
}> = [
  { label: '启用', value: 'enabled' },
  { label: '禁用', value: 'disabled' },
  { label: '配置错误', value: 'error' },
];

export const scheduleSourceOptions: Array<{
  label: string;
  value: TaskScheduleSource;
}> = [
  { label: '内建', value: 'builtin' },
  { label: '用户', value: 'user' },
];

export function useScheduleFormSchema(): VbenFormSchema[] {
  return [
    { component: 'Input', fieldName: 'executor_code', label: '执行编码' },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: scheduleStatusOptions },
      fieldName: 'status',
      label: '状态',
    },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: scheduleSourceOptions },
      fieldName: 'source',
      label: '来源',
    },
  ];
}

export const overlapPolicyOptions: Array<{
  label: string;
  value: TaskScheduleOverlapPolicy;
}> = [
  { label: '等待当前执行完成', value: 'wait' },
  { label: '允许并发执行', value: 'allow' },
];

export const misfirePolicyOptions: Array<{
  label: string;
  value: TaskScheduleMisfirePolicy;
}> = [
  { label: '补触发一次', value: 'fire_once' },
  { label: '跳过过期', value: 'skip' },
];

export function scheduleStatusLabel(status: TaskScheduleStatus) {
  return (
    scheduleStatusOptions.find((item) => item.value === status)?.label ?? status
  );
}

export function scheduleStatusColor(status: TaskScheduleStatus) {
  const colors: Record<TaskScheduleStatus, string> = {
    disabled: 'default',
    enabled: 'success',
    error: 'error',
  };
  return colors[status];
}

export function sourceLabel(source: TaskScheduleSource) {
  return (
    scheduleSourceOptions.find((item) => item.value === source)?.label ?? source
  );
}

export function scheduleColumns(
  onStatusChange?: (
    status: TaskScheduleStatus,
    row: TaskSchedule,
  ) => PromiseLike<boolean | undefined>,
): VxeTableGridColumns<TaskSchedule> {
  return [
    { field: 'id', fixed: 'left', sortable: true, title: 'ID', width: 90 },
    {
      cellRender: {
        attrs: { beforeChange: onStatusChange },
        name: onStatusChange ? 'CellSwitch' : 'CellTag',
        options: scheduleStatusOptions,
        props: { checkedValue: 'enabled', unCheckedValue: 'disabled' },
      },
      field: 'status',
      title: '状态',
      width: 100,
    },
    { field: 'schedule_name', minWidth: 180, title: '名称' },
    {
      field: 'executor_code',
      minWidth: 200,
      sortable: true,
      title: '执行编码',
    },
    {
      cellRender: { name: 'CellTag', options: scheduleSourceOptions },
      field: 'source',
      title: '来源',
      width: 90,
    },
    { field: 'cron_expr', minWidth: 170, title: 'Cron' },
    { field: 'params_summary', minWidth: 130, title: '参数' },
    {
      field: 'next_fire_at',
      formatter: ({ row }) => Times.formatOptionalUnix(row.next_fire_at),
      sortable: true,
      title: '下次触发',
      width: 180,
    },
    {
      field: 'last_fire_at',
      formatter: ({ row }) => Times.formatOptionalUnix(row.last_fire_at),
      sortable: true,
      title: '最近 Cron',
      width: 180,
    },
    {
      field: 'last_manual_trigger_at',
      formatter: ({ row }) =>
        Times.formatOptionalUnix(row.last_manual_trigger_at),
      title: '最近手动',
      width: 180,
    },
    { field: 'empty_fire_count', title: '空跑', width: 90 },
    {
      field: 'operation',
      fixed: 'right',
      slots: { default: 'scheduleOperation' },
      title: '操作',
      width: 280,
    },
  ];
}
