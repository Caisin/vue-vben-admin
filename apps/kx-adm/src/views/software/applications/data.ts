import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type {
  SoftwareApplication,
  SoftwareInstallation,
  SoftwareVersion,
} from '#/api/software';

import { Times } from '#/times';

export const providerOptions = [
  { label: 'GitHub Release', value: 'github_release' },
  { label: 'Certimate', value: 'certimate' },
  { label: 'RustFS', value: 'rustfs' },
  { label: 'Redis', value: 'redis' },
  { label: 'MySQL', value: 'mysql' },
  { label: 'PostgreSQL', value: 'postgres' },
  { label: 'Meilisearch', value: 'meilisearch' },
];

export const softwareStateOptions = [
  { label: '启用', value: 'enabled' },
  { label: '停用', value: 'disabled' },
];

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'keyword',
      label: '应用',
      componentProps: { placeholder: '名称或编码' },
    },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: providerOptions },
      fieldName: 'provider',
      label: '实现',
    },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: softwareStateOptions },
      fieldName: 'state',
      label: '状态',
    },
  ];
}

export function useColumns(): VxeTableGridColumns<SoftwareApplication> {
  return [
    {
      field: 'name',
      fixed: 'left',
      minWidth: 200,
      slots: { default: 'application' },
      title: '应用',
    },
    { field: 'provider', minWidth: 150, title: '实现' },
    { field: 'application_kind', minWidth: 110, title: '类型' },
    { field: 'install_root', minWidth: 180, title: '安装根目录' },
    {
      field: 'state',
      slots: { default: 'state' },
      title: '状态',
      width: 90,
    },
    {
      align: 'right',
      field: 'operation',
      fixed: 'right',
      headerAlign: 'center',
      showOverflow: false,
      slots: { default: 'operation' },
      title: '操作',
      width: 210,
    },
  ];
}

export function useVersionColumns(): VxeTableGridColumns<SoftwareVersion> {
  return [
    { field: 'display_version', minWidth: 130, title: '版本' },
    { field: 'immutable_ref', minWidth: 260, title: '不可变引用' },
    {
      field: 'released_at',
      formatter: ({ row }) => Times.formatOptionalUnix(row.released_at),
      minWidth: 170,
      title: '发布时间',
    },
  ];
}

export function useInstallationColumns(): VxeTableGridColumns<SoftwareInstallation> {
  return [
    {
      field: 'server_name',
      minWidth: 180,
      slots: { default: 'server' },
      title: '服务器',
    },
    { field: 'instance_key', minWidth: 120, title: '实例' },
    {
      field: 'observed_version',
      minWidth: 130,
      slots: { default: 'observedVersion' },
      title: '已装版本',
    },
    {
      field: 'available_version',
      minWidth: 130,
      slots: { default: 'availableVersion' },
      title: '可用更新',
    },
    { field: 'state', minWidth: 100, title: '状态' },
  ];
}
