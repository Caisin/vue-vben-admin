import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { SoftwareOperation } from '#/api/software';

export const operationStateOptions = [
  { label: '等待中', value: 'pending' },
  { label: '执行中', value: 'running' },
  { label: '成功', value: 'succeeded' },
  { label: '失败', value: 'failed' },
  { label: '已取消', value: 'cancelled' },
];

export function useGridFormSchema(
  serverOptions: () => Array<{ label: string; value: number | string }>,
  applicationOptions: () => Array<{ label: string; value: number | string }>,
): VbenFormSchema[] {
  return [
    {
      component: 'Select',
      componentProps: () => ({ allowClear: true, options: serverOptions() }),
      fieldName: 'server_id',
      label: '服务器',
    },
    {
      component: 'Select',
      componentProps: () => ({
        allowClear: true,
        options: applicationOptions(),
      }),
      fieldName: 'application_id',
      label: '应用',
    },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: operationStateOptions },
      fieldName: 'state',
      label: '状态',
    },
  ];
}

export function useColumns(): VxeTableGridColumns<SoftwareOperation> {
  return [
    { field: 'id', fixed: 'left', title: 'ID', width: 90 },
    {
      field: 'action',
      minWidth: 110,
      slots: { default: 'action' },
      title: '操作',
    },
    { field: 'target_version', minWidth: 130, title: '目标版本' },
    {
      field: 'state',
      slots: { default: 'state' },
      title: '状态',
      width: 100,
    },
    { field: 'step', title: '步骤', width: 80 },
    {
      field: 'error_summary',
      minWidth: 260,
      showOverflow: 'tooltip',
      title: '错误摘要',
    },
    {
      align: 'right',
      field: 'operation',
      fixed: 'right',
      headerAlign: 'center',
      slots: { default: 'operation' },
      title: '操作',
      width: 90,
    },
  ];
}
