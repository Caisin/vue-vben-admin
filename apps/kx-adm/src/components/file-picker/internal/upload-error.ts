interface ErrorDetails {
  code?: string;
  hostId?: string;
  message?: string;
  requestId?: string;
  status?: string;
}

const MAX_DETAIL_LENGTH = 1500;

function recordOf(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function nonEmptyString(value: unknown) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number') return String(value);
  return undefined;
}

function firstString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = nonEmptyString(record[key]);
    if (value) return value;
  }
  return undefined;
}

function sanitizeDetail(value: string) {
  const sanitized = value
    .replaceAll(/https?:\/\/[^\s<>"']+/gi, (url) => {
      try {
        const parsed = new URL(url);
        return `${parsed.origin}${parsed.pathname}`;
      } catch {
        return url.replace(/[?#].*$/, '');
      }
    })
    .replaceAll(
      /<(authorization|accesskeyid|secretaccesskey|securitytoken|signature)>[\s\S]*?<\/\1>/gi,
      '<$1>[已脱敏]</$1>',
    )
    .replaceAll(
      /authorization\s*[:=]\s*(?:bearer\s+)?[^\s,;]+/gi,
      'Authorization=[已脱敏]',
    )
    .replaceAll(
      /(access[_-]?key(?:[_-]?id)?|secret(?:[_-]?access)?[_-]?key|security[_-]?token|signature)\s*[:=]\s*[^\s,;]+/gi,
      '$1=[已脱敏]',
    )
    .trim();
  return sanitized.length > MAX_DETAIL_LENGTH
    ? `${sanitized.slice(0, MAX_DETAIL_LENGTH)}...`
    : sanitized;
}

function parseXmlDetails(body: string): ErrorDetails | undefined {
  if (!body.trim().startsWith('<') || typeof DOMParser === 'undefined') {
    return undefined;
  }
  const document = new DOMParser().parseFromString(body, 'application/xml');
  if (document.querySelector('parsererror')) return undefined;
  const text = (name: string) =>
    document.querySelector(name)?.textContent?.trim() || undefined;
  return {
    code: text('Code'),
    hostId: text('HostId'),
    message: text('Message'),
    requestId: text('RequestId'),
  };
}

function detailsFromBody(body: unknown): ErrorDetails {
  if (typeof body === 'string') {
    const xml = parseXmlDetails(body);
    if (xml) return xml;
    try {
      return detailsFromBody(JSON.parse(body));
    } catch {
      return { message: body.trim() || undefined };
    }
  }
  const record = recordOf(body);
  if (!record) return {};
  const nested = recordOf(record.error);
  return {
    code:
      firstString(record, ['code', 'error_code', 'errorCode']) ??
      (nested
        ? firstString(nested, ['code', 'error_code', 'errorCode'])
        : undefined),
    hostId: firstString(record, ['host_id', 'hostId', 'HostId']),
    message:
      firstString(record, ['msg', 'message', 'Message', 'detail']) ??
      (nested
        ? firstString(nested, ['msg', 'message', 'Message', 'detail'])
        : undefined),
    requestId: firstString(record, [
      'request_id',
      'requestId',
      'RequestId',
      'trace_id',
      'traceId',
    ]),
  };
}

function formatDetails(details: ErrorDetails, fallback: string) {
  const parts = [
    details.status,
    details.code ? `错误码: ${details.code}` : undefined,
    details.message,
    details.requestId ? `RequestId: ${details.requestId}` : undefined,
    details.hostId ? `HostId: ${details.hostId}` : undefined,
  ].filter(Boolean);
  return sanitizeDetail(parts.join('；') || fallback);
}

/** 格式化上传接口错误，仅展示诊断字段，避免把签名 URL 或凭证带入通知。 */
export function uploadErrorMessage(error: unknown, fallback = '上传失败') {
  const record = recordOf(error);
  if (!record) {
    const directMessage = nonEmptyString(error);
    return directMessage ? sanitizeDetail(directMessage) : fallback;
  }
  const response = recordOf(record.response);
  const responseDetails = detailsFromBody(response?.data);
  const directDetails = detailsFromBody(error);
  const status = nonEmptyString(response?.status);
  const statusText = nonEmptyString(response?.statusText);
  return formatDetails(
    {
      code: responseDetails.code ?? directDetails.code,
      hostId: responseDetails.hostId ?? directDetails.hostId,
      message:
        responseDetails.message ??
        directDetails.message ??
        nonEmptyString(record.message),
      requestId: responseDetails.requestId ?? directDetails.requestId,
      status: status
        ? `HTTP ${status}${statusText ? ` ${statusText}` : ''}`
        : undefined,
    },
    fallback,
  );
}

/** 格式化对象存储直传返回，保留 TOS 的 Code、Message 和请求追踪标识。 */
export function objectStorageErrorMessage(
  status: number,
  statusText: string,
  responseBody: string,
) {
  const details = detailsFromBody(responseBody);
  return formatDetails(
    {
      ...details,
      status: `HTTP ${status}${statusText.trim() ? ` ${statusText.trim()}` : ''}`,
    },
    `直传对象存储失败: HTTP ${status}`,
  );
}
