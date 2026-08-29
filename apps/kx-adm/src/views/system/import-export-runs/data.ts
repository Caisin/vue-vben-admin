import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type {
  TransferRunListItem,
  TransferRunStatus,
} from '#/api/import-export';

import { Times } from '#/times';

export const directionOptions = [
  { label: '导入', value: 'import' },
  { label: '导出', value: 'export' },
];

export const statusOptions: Array<{
  label: string;
  value: TransferRunStatus;
}> = [
  { label: '已提交', value: 'submitted' },
  { label: '提交失败', value: 'submit_failed' },
  { label: '处理中', value: 'running' },
  { label: '成功', value: 'succeeded' },
  { label: '部分成功', value: 'partially_succeeded' },
  { label: '失败', value: 'failed' },
  { label: '已取消', value: 'cancelled' },
];

export function statusLabel(status: TransferRunStatus) {
  return (
    statusOptions.find((option) => option.value === status)?.label ?? status
  );
}

export function statusColor(status: TransferRunStatus) {
  if (status === 'succeeded') return 'success';
  if (status === 'partially_succeeded') return 'warning';
  if (['cancelled', 'failed', 'submit_failed'].includes(status)) return 'error';
  return 'processing';
}

export function formSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: '例如 developer_account',
      },
      fieldName: 'definition_code',
      label: '业务编码',
    },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: directionOptions },
      fieldName: 'direction',
      label: '方向',
    },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: statusOptions },
      fieldName: 'status',
      label: '状态',
    },
  ];
}

export function columns(): VxeTableGridColumns<TransferRunListItem> {
  return [
    {
      field: 'created_at',
      formatter: ({ cellValue }) => Times.formatOptionalUnix(cellValue),
      title: '提交时间',
      width: 180,
    },
    {
      field: 'definition_name',
      minWidth: 220,
      slots: { default: 'definition' },
      title: '业务',
    },
    {
      field: 'direction',
      slots: { default: 'direction' },
      title: '方向',
      width: 90,
    },
    {
      field: 'status',
      slots: { default: 'status' },
      title: '状态',
      width: 110,
    },
    {
      field: 'succeeded_count',
      formatter: ({ row }) =>
        `${row.succeeded_count}/${row.total_count ?? '-'}${row.failed_count ? `，失败 ${row.failed_count}` : ''}`,
      title: '处理数量',
      width: 160,
    },
    {
      field: 'message',
      minWidth: 240,
      showOverflow: 'tooltip',
      title: '结果',
    },
    {
      field: 'finished_at',
      formatter: ({ cellValue }) => Times.formatOptionalUnix(cellValue),
      title: '完成时间',
      width: 180,
    },
    {
      field: 'expires_at',
      formatter: ({ cellValue }) => Times.formatOptionalUnix(cellValue),
      title: '文件保留至',
      width: 180,
    },
    { field: 'files', slots: { default: 'files' }, title: '文件', width: 260 },
  ];
}
