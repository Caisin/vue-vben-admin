import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type {
  OrgSnapshotEvent,
  OrgSnapshotRecord,
  OrgSyncRun,
  OrgSyncStatus,
  OrgUserLink,
} from '#/api/auth';

export const syncStatusOptions: Array<{
  label: string;
  value: OrgSyncStatus;
}> = [
  { label: '执行中', value: 'running' },
  { label: '成功', value: 'succeeded' },
  { label: '失败', value: 'failed' },
];

export const historyEventOptions: Array<{
  label: string;
  value: OrgSnapshotEvent;
}> = [
  { label: '首次同步', value: 'joined' },
  { label: '资料变更', value: 'updated' },
  { label: '无变化', value: 'unchanged' },
  { label: '离职', value: 'left' },
  { label: '再入职', value: 'rejoined' },
];

export function useRunFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Select',
      componentProps: { allowClear: true, options: syncStatusOptions },
      fieldName: 'status',
      label: '任务状态',
    },
  ];
}

export function useUserFormSchema(): VbenFormSchema[] {
  return [
    { component: 'Input', fieldName: 'display_name_prefix', label: '人员姓名' },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: '在职', value: true },
          { label: '离职', value: false },
        ],
      },
      fieldName: 'active',
      label: '人员状态',
    },
  ];
}

export function useHistoryFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Select',
      componentProps: { allowClear: true, options: historyEventOptions },
      fieldName: 'event',
      label: '变化类型',
    },
  ];
}

export function syncStatusLabel(status: OrgSyncStatus) {
  return (
    syncStatusOptions.find((item) => item.value === status)?.label ?? status
  );
}

export function syncStatusColor(status: OrgSyncStatus) {
  const colors: Record<OrgSyncStatus, string> = {
    failed: 'error',
    running: 'processing',
    succeeded: 'success',
  };
  return colors[status];
}

export function historyEventLabel(event: OrgSnapshotEvent) {
  return (
    historyEventOptions.find((item) => item.value === event)?.label ?? event
  );
}

export function historyEventColor(event: OrgSnapshotEvent) {
  const colors: Record<OrgSnapshotEvent, string> = {
    joined: 'success',
    left: 'error',
    rejoined: 'cyan',
    unchanged: 'default',
    updated: 'processing',
  };
  return colors[event];
}

export function runColumns(): VxeTableGridColumns<OrgSyncRun> {
  return [
    {
      field: 'started_at',
      sortable: true,
      fixed: 'left',
      slots: { default: 'runTime' },
      title: '执行时间',
      width: 180,
    },
    {
      field: 'status',
      slots: { default: 'runStatus' },
      title: '状态',
      width: 100,
    },
    {
      field: 'source_id',
      minWidth: 180,
      title: '数据源',
    },
    {
      field: 'department_total',
      slots: { default: 'departmentSummary' },
      title: '部门',
      width: 220,
    },
    {
      field: 'user_total',
      slots: { default: 'userSummary' },
      title: '人员',
      width: 280,
    },
    {
      field: 'error_message',
      minWidth: 260,
      slots: { default: 'runError' },
      title: '错误摘要',
    },
    {
      field: 'finished_at',
      sortable: true,
      slots: { default: 'finishedAt' },
      title: '完成时间',
      width: 180,
    },
  ];
}

export function userColumns(): VxeTableGridColumns<OrgUserLink> {
  return [
    {
      field: 'display_name',
      sortable: true,
      fixed: 'left',
      minWidth: 180,
      slots: { default: 'userName' },
      title: '人员',
    },
    {
      field: 'active',
      sortable: true,
      slots: { default: 'userStatus' },
      title: '状态',
      width: 100,
    },
    { field: 'uid', title: '本地用户 ID', width: 140 },
    {
      field: 'mobile',
      minWidth: 160,
      slots: { default: 'contactInfo' },
      title: '号码信息',
    },
    { field: 'source_id', minWidth: 180, title: '数据源' },
    {
      field: 'first_seen_at',
      sortable: true,
      slots: { default: 'firstSeenAt' },
      title: '首次发现',
      width: 180,
    },
    {
      field: 'last_seen_at',
      sortable: true,
      slots: { default: 'lastSeenAt' },
      title: '最近发现',
      width: 180,
    },
    {
      field: 'left_at',
      slots: { default: 'leftAt' },
      title: '最近离职',
      width: 180,
    },
    {
      align: 'right',
      field: 'rejoin_count',
      sortable: true,
      title: '再入职次数',
      width: 120,
    },
    {
      field: 'actions',
      fixed: 'right',
      slots: { default: 'actions' },
      title: '操作',
      width: 130,
    },
  ];
}

export function historyColumns(): VxeTableGridColumns<OrgSnapshotRecord> {
  return [
    {
      field: 'captured_at',
      sortable: true,
      slots: { default: 'capturedAt' },
      title: '同步时间',
      width: 180,
    },
    {
      field: 'event',
      slots: { default: 'event' },
      title: '变化',
      width: 110,
    },
    { field: 'sync_id', title: '任务 ID', width: 120 },
    {
      field: 'payload',
      slots: { default: 'payload' },
      title: '原始数据',
      width: 110,
    },
  ];
}
