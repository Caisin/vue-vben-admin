import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type {
  CredentialKind,
  CredentialProfileSpec,
  CredentialState,
  CredentialView,
} from '#/api/credential';

import { Times } from '#/times';

export const kindOptions: { label: string; value: CredentialKind }[] = [
  { label: 'Access Key', value: 'access_key' },
  { label: '账号密码', value: 'username_password' },
  { label: '密码', value: 'password' },
  { label: 'HTTP Token/JWT', value: 'http_token' },
  { label: 'HTTP Header', value: 'http_header' },
  { label: 'SSH Key', value: 'ssh_key' },
  { label: 'TikTok Web', value: 'tt_web' },
];

export const stateOptions: {
  color: string;
  label: string;
  value: CredentialState;
}[] = [
  { color: 'success', label: '启用', value: 'active' },
  { color: 'warning', label: '禁用', value: 'disabled' },
  { color: 'default', label: '退役', value: 'retired' },
];

export function kindLabel(kind?: CredentialKind) {
  return kindOptions.find((item) => item.value === kind)?.label ?? kind ?? '-';
}

export function stateLabel(state?: CredentialState) {
  return (
    stateOptions.find((item) => item.value === state)?.label ?? state ?? '-'
  );
}

export function summaryText(row: Pick<CredentialView, 'summary'>) {
  return (
    (row.summary?.fields ?? [])
      .filter((field) => field.configured)
      .map((field) =>
        field.masked_hint
          ? `${field.field}:${field.masked_hint}`
          : `${field.field}:已配置`,
      )
      .join('；') || '-'
  );
}

export function profileOptions(
  profiles: CredentialProfileSpec[],
  kind?: CredentialKind,
) {
  return profiles
    .filter((item) => !kind || item.kind === kind)
    .map((item) => ({
      label: `${kindLabel(item.kind)} / ${item.label}`,
      value: `${item.kind}:${item.profile}`,
    }));
}

export function useFormSchema(
  profiles: CredentialProfileSpec[] = [],
): VbenFormSchema[] {
  return [
    { component: 'Input', fieldName: 'code_prefix', label: '编码' },
    { component: 'Input', fieldName: 'name_prefix', label: '名称' },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: kindOptions },
      fieldName: 'kind',
      label: '类型',
    },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: profileOptions(profiles) },
      fieldName: 'profile_pair',
      label: 'Profile',
    },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: stateOptions },
      fieldName: 'state',
      label: '状态',
    },
  ];
}

export function useColumns(): VxeTableGridColumns<CredentialView> {
  return [
    { field: 'id', title: 'ID', width: 90 },
    {
      field: 'name',
      fixed: 'left',
      slots: { default: 'name' },
      sortable: true,
      title: '名称',
      width: 140,
    },
    { field: 'code', minWidth: 180, sortable: true, title: '编码' },
    { field: 'kind', slots: { default: 'kind' }, title: '类型', width: 140 },
    { field: 'profile', minWidth: 120, sortable: true, title: 'Profile' },
    { field: 'state', slots: { default: 'state' }, title: '状态', width: 110 },
    {
      field: 'summary',
      minWidth: 220,
      slots: { default: 'summary' },
      title: '字段摘要',
    },
    { field: 'binding_count', title: '绑定', width: 80 },
    {
      field: 'expires_at',
      formatter: ({ row }) => Times.formatOptionalUnix(row.expires_at),
      title: '过期时间',
      width: 180,
    },
    {
      field: 'updated_at',
      formatter: ({ row }) => Times.formatOptionalUnix(row.updated_at),
      sortable: true,
      title: '更新时间',
      width: 180,
    },
    {
      field: 'operation',
      fixed: 'right',
      slots: { default: 'operation' },
      title: '操作',
      width: 220,
    },
  ];
}
