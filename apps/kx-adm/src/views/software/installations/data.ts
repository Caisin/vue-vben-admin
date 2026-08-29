import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { SoftwareInstallation } from '#/api/software';

export const installationStateOptions = [
  { label: '未知', value: 'unknown' },
  { label: '安装中', value: 'installing' },
  { label: '运行中', value: 'running' },
  { label: '已停止', value: 'stopped' },
  { label: '失败', value: 'failed' },
  { label: '已移除', value: 'removed' },
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
      componentProps: { allowClear: true, options: installationStateOptions },
      fieldName: 'state',
      label: '状态',
    },
  ];
}

export function useColumns(): VxeTableGridColumns<SoftwareInstallation> {
  return [
    {
      field: 'application_name',
      fixed: 'left',
      minWidth: 230,
      slots: { default: 'instance' },
      title: '实例',
    },
    {
      field: 'observed_version',
      minWidth: 190,
      slots: { default: 'versions' },
      title: '版本',
    },
    {
      field: 'state',
      slots: { default: 'state' },
      title: '状态',
      width: 100,
    },
    {
      field: 'health',
      slots: { default: 'health' },
      title: '健康状态',
      width: 100,
    },
    {
      field: 'last_error',
      minWidth: 220,
      showOverflow: 'tooltip',
      title: '最近错误',
    },
    {
      align: 'right',
      field: 'operation',
      fixed: 'right',
      headerAlign: 'center',
      showOverflow: false,
      slots: { default: 'operation' },
      title: '操作',
      width: 150,
    },
  ];
}
