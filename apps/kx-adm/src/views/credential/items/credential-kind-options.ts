import type { CredentialKind } from '#/api/credential';

export const kindOptions: { label: string; value: CredentialKind }[] = [
  { label: '微信', value: 'wechat' },
  { label: '钉钉', value: 'dingtalk' },
  { label: '抖音', value: 'douyin' },
  { label: '快手', value: 'kuaishou' },
  { label: '微信商户', value: 'wechat_merchant' },
  { label: 'TikTok', value: 'tiktok' },
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

export const credentialKindTabs: {
  label: string;
  value: 'all' | CredentialKind;
}[] = [{ label: '所有', value: 'all' }, ...kindOptions];

export function kindLabel(kind?: CredentialKind) {
  return kindOptions.find((item) => item.value === kind)?.label ?? kind ?? '-';
}
