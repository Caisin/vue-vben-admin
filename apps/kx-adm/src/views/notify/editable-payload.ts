import type { JsonValue } from '#/api/request';

const sensitivePayloadKeys = new Set([
  'accesstoken',
  'apikey',
  'appsecret',
  'authorization',
  'clientsecret',
  'credential',
  'credentials',
  'idtoken',
  'passwd',
  'password',
  'privatekey',
  'providersecret',
  'providertoken',
  'refreshtoken',
  'secret',
  'secretkey',
  'sign',
  'token',
  'webhook',
  'webhookurl',
]);

export function editableNotifyPayload(value: JsonValue): JsonValue {
  if (Array.isArray(value))
    return value.map((item) => editableNotifyPayload(item));
  if (!value || typeof value !== 'object') return value;
  const result: Record<string, JsonValue> = {};
  for (const [key, item] of Object.entries(value)) {
    const normalized = key.replaceAll(/[_-]/g, '').toLowerCase();
    if (sensitivePayloadKeys.has(normalized)) continue;
    if (['atmobiles', 'mobiles'].includes(normalized) && Array.isArray(item)) {
      result[key] = item.filter(
        (mobile): mobile is string =>
          typeof mobile === 'string' && !mobile.includes('*'),
      );
      continue;
    }
    result[key] = editableNotifyPayload(item);
  }
  return result;
}

export function editableNotifyPayloadObject(value: JsonValue) {
  const payload = editableNotifyPayload(value);
  if (!payload || Array.isArray(payload) || typeof payload !== 'object') {
    return {};
  }
  return payload as Record<string, JsonValue>;
}
