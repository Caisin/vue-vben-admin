export interface DingtalkWebhookConfig {
  accessToken: string;
  keyword?: string;
  webhookUrl: string;
}

const WEBHOOK_HOST = 'oapi.dingtalk.com';
const WEBHOOK_PATH = '/robot/send';

export function parseDingtalkWebhookConfig(
  input: string,
): DingtalkWebhookConfig {
  const value = input.trim();
  if (!value) throw new Error('请填写钉钉群机器人 Webhook URL');

  let webhook: URL;
  try {
    webhook = new URL(value);
  } catch {
    throw new Error('钉钉群机器人 Webhook 地址格式无效');
  }
  if (webhook.hostname !== WEBHOOK_HOST || webhook.pathname !== WEBHOOK_PATH) {
    throw new Error('只支持钉钉官方自定义机器人 Webhook 地址');
  }

  const accessToken = webhook.searchParams.get('access_token')?.trim() ?? '';
  if (!accessToken) throw new Error('Webhook 缺少 access_token');

  const keyword =
    webhook.searchParams.get('keyword')?.trim() ||
    webhook.searchParams.get('keywords')?.trim() ||
    undefined;
  const normalized = new URL(`https://${WEBHOOK_HOST}${WEBHOOK_PATH}`);
  normalized.searchParams.set('access_token', accessToken);
  if (keyword) normalized.searchParams.set('keyword', keyword);
  return {
    accessToken,
    keyword,
    webhookUrl: normalized.toString(),
  };
}
