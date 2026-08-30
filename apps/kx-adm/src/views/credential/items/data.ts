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
  { label: 'Firebase 服务账号', value: 'google_service_account' },
  { label: '参数 JSON 机密', value: 'json_secret' },
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

export const riskOptions = [
  { label: '即将过期（7 天内）', value: 'expiring' },
  { label: '最近使用失败', value: 'failed' },
];

const summaryFieldLabels: Record<string, string> = {
  access_key_id: 'Access Key',
  base_url: '地址',
  cookie: 'Cookie',
  header_name: '请求头',
  password: '密码',
  passphrase: '私钥口令',
  private_key: '私钥',
  public_key: '公钥',
  scheme: '认证方案',
  secret_access_key: 'Secret',
  session_token: 'Session Token',
  token: 'Token',
  user_agent: 'User-Agent',
  username: '用户名',
  value: '值',
  service_account_json: 'Service Account JSON',
  json: 'JSON 机密',
};

export function kindLabel(kind?: CredentialKind) {
  return kindOptions.find((item) => item.value === kind)?.label ?? kind ?? '-';
}

export function stateLabel(state?: CredentialState) {
  return (
    stateOptions.find((item) => item.value === state)?.label ?? state ?? '-'
  );
}

export function summaryText(row: Pick<CredentialView, 'summary'>) {
  const fields = row.summary?.fields ?? [];
  if (fields.length === 0) return '未配置';
  const configuredCount = fields.filter((field) => field.configured).length;
  const details = fields.slice(0, 3).map((field) => {
    const label = summaryFieldLabels[field.field] ?? field.field;
    return `${label}：${field.configured ? '已配置' : '未配置'}`;
  });
  return `已配置 ${configuredCount}/${fields.length} 项 · ${details.join('；')}`;
}

export function expiryInfo(
  value: number | string | undefined,
  now = Math.floor(Date.now() / 1000),
) {
  const expiresAt = Number(value ?? 0);
  if (!Number.isFinite(expiresAt) || expiresAt <= 0) {
    return { color: 'default', days: undefined, label: '永不过期' } as const;
  }
  const seconds = expiresAt - now;
  if (seconds <= 0)
    return { color: 'error', days: 0, label: '已过期' } as const;
  const days = Math.ceil(seconds / 86_400);
  if (days <= 7) {
    return { color: 'warning', days, label: `还有 ${days} 天` } as const;
  }
  return { color: 'success', days, label: `${days} 天后过期` } as const;
}

export function profileOptions(
  profiles: CredentialProfileSpec[],
  kind?: CredentialKind,
) {
  return profiles
    .filter((item) => !kind || item.kind === kind)
    .map((item) => ({
      // 未选择类型时保留类型前缀，避免不同类型下的同名 Profile 产生歧义。
      label: kind ? item.label : `${kindLabel(item.kind)} / ${item.label}`,
      value: `${item.kind}:${item.profile}`,
    }));
}

export function useFormSchema(
  profiles: CredentialProfileSpec[] = [],
): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: { placeholder: '例如：aws-prod-' },
      fieldName: 'code_prefix',
      label: '编码前缀',
    },
    {
      component: 'Input',
      componentProps: { placeholder: '例如：生产环境' },
      fieldName: 'name_prefix',
      label: '名称前缀',
    },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: kindOptions },
      fieldName: 'kind',
      label: '类型',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: profileOptions(profiles),
        placeholder: '可选，按 Profile 筛选',
        showSearch: true,
      },
      dependencies: {
        resolve: ({ values }) => ({
          componentProps: {
            allowClear: true,
            options: profileOptions(profiles, values.kind),
            placeholder: values.kind
              ? '可选，筛选该类型下的 Profile'
              : '可选，按 Profile 筛选',
            showSearch: true,
          },
        }),
        triggerFields: ['kind'],
      },
      fieldName: 'profile_pair',
      label: 'Profile',
    },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: stateOptions },
      fieldName: 'state',
      label: '状态',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: riskOptions,
        placeholder: '按风险快速定位',
      },
      fieldName: 'risk',
      label: '风险',
    },
  ];
}

export function useColumns(): VxeTableGridColumns<CredentialView> {
  return [
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
    {
      field: 'health',
      slots: { default: 'health' },
      title: '使用状态',
      width: 130,
    },
    { field: 'binding_count', title: '绑定', width: 80 },
    {
      field: 'expires_at',
      slots: { default: 'expires' },
      title: '有效期',
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
      width: 180,
    },
  ];
}
