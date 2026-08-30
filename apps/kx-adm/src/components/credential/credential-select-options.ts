import type { CredentialKind, CredentialView } from '#/api/credential';

function credentialKindLabel(kind: CredentialKind) {
  if (kind === 'wechat') return '微信';
  if (kind === 'dingtalk') return '钉钉';
  if (kind === 'douyin') return '抖音';
  if (kind === 'kuaishou') return '快手';
  if (kind === 'wechat_merchant') return '微信商户';
  if (kind === 'tiktok') return 'TikTok';
  if (kind === 'access_key') return '访问密钥';
  if (kind === 'password') return '密码';
  if (kind === 'username_password') return '账号密码';
  return kind;
}

export function credentialSelectOptions(credentials: CredentialView[]) {
  return credentials.map((item) => ({
    label: `${item.name} · ${credentialKindLabel(item.kind)} (${item.code})`,
    value: item.code,
  }));
}
