import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { SoftwareInstallation, SoftwareServer } from '#/api/software';

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'keyword',
      label: '服务器',
      componentProps: { placeholder: '名称、编码或主机地址' },
    },
  ];
}

export function useColumns(): VxeTableGridColumns<SoftwareServer> {
  return [
    {
      field: 'name',
      fixed: 'left',
      minWidth: 190,
      slots: { default: 'server' },
      title: '服务器',
    },
    {
      field: 'host',
      minWidth: 190,
      slots: { default: 'host' },
      title: '连接地址',
    },
    {
      field: 'os',
      minWidth: 150,
      slots: { default: 'platform' },
      title: '平台',
    },
    { field: 'service_manager', minWidth: 130, title: '服务管理器' },
    {
      field: 'state',
      slots: { default: 'state' },
      title: '状态',
      width: 90,
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
      width: 120,
    },
  ];
}

export function useInstallationColumns(): VxeTableGridColumns<SoftwareInstallation> {
  return [
    {
      field: 'application_name',
      minWidth: 180,
      slots: { default: 'application' },
      title: '应用',
    },
    { field: 'instance_key', minWidth: 120, title: '实例' },
    {
      field: 'observed_version',
      minWidth: 130,
      slots: { default: 'version' },
      title: '版本',
    },
    { field: 'state', minWidth: 100, title: '状态' },
    { field: 'health', minWidth: 100, title: '健康状态' },
  ];
}
