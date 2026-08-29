import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { AuditLog } from '#/api/system/audit-log';

import { Times } from '#/times';

const methodOptions = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map(
  (value) => ({ label: value, value }),
);

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'InputNumber',
      componentProps: { min: 1, precision: 0 },
      fieldName: 'uid',
      label: '用户 ID',
    },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: methodOptions },
      fieldName: 'method',
      label: 'HTTP 方法',
    },
    {
      component: 'Input',
      fieldName: 'api_path_prefix',
      label: 'API 路径',
    },
    {
      component: 'InputNumber',
      componentProps: { max: 599, min: 100, precision: 0 },
      fieldName: 'http_status',
      label: 'HTTP 状态',
    },
    {
      component: 'RangePicker',
      componentProps: { showTime: true },
      fieldName: 'created_range',
      label: '完成时间',
    },
  ];
}

export function useColumns(): VxeTableGridColumns<AuditLog> {
  return [
    {
      field: 'created_at',
      formatter: ({ cellValue }) => Times.formatOptionalUnix(cellValue),
      sortable: true,
      title: '完成时间',
      width: 180,
    },
    { field: 'uid', sortable: true, title: '用户 ID', width: 110 },
    { field: 'method', title: '方法', width: 90 },
    {
      field: 'api_path',
      minWidth: 300,
      showOverflow: 'tooltip',
      slots: { default: 'apiPath' },
      sortable: true,
      title: 'API 路径',
    },
    {
      field: 'http_status',
      sortable: true,
      title: 'HTTP 状态',
      width: 110,
    },
    {
      field: 'duration_ms',
      formatter: ({ cellValue }) => `${cellValue ?? 0} ms`,
      sortable: true,
      title: '耗时',
      width: 110,
    },
    { field: 'remote_ip', minWidth: 150, title: '来源 IP' },
    {
      field: 'query_summary',
      formatter: ({ row }) => {
        const value = row.query_summary;
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          return '-';
        }
        const count = value.parameter_count;
        return typeof count === 'number' ? `${count} 个参数` : '无参数';
      },
      title: '查询摘要',
      width: 120,
    },
    {
      field: 'debug_enabled',
      formatter: ({ cellValue }) => (cellValue ? '调试' : '普通'),
      title: '模式',
      width: 90,
    },
    {
      field: 'user_agent',
      minWidth: 260,
      showOverflow: 'tooltip',
      title: 'User-Agent',
    },
  ];
}
