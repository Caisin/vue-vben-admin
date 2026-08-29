function messageFrom(value: unknown) {
  if (typeof value !== 'object' || value === null || !('msg' in value)) {
    return undefined;
  }
  return typeof value.msg === 'string' && value.msg.trim()
    ? value.msg
    : undefined;
}

/** 优先返回 kx-axum 错误响应的 `msg`，兼容 Axios 错误和直接抛出的响应体。 */
export function requestErrorMessage(error: unknown, fallback: string) {
  if (typeof error !== 'object' || error === null) return fallback;

  if ('response' in error) {
    const response = error.response;
    if (
      typeof response === 'object' &&
      response !== null &&
      'data' in response
    ) {
      const message = messageFrom(response.data);
      if (message) return message;
    }
  }
  return messageFrom(error) ?? fallback;
}

export function isRequestNotFound(error: unknown) {
  if (typeof error !== 'object' || error === null) return false;

  // RequestClient 会将 Axios 错误转换为 response.data 后重新抛出，优先识别 kx-axum 的业务响应体。
  if ('code' in error && error.code === 404) return true;
  return (
    'response' in error &&
    (error.response as undefined | { status?: number })?.status === 404
  );
}

export function isStepUpGrantRejected(error: unknown) {
  if (typeof error !== 'object' || error === null) return false;

  let message = '';
  if ('msg' in error) {
    message = String(error.msg);
  } else if ('message' in error) {
    message = String(error.message);
  }
  return (
    message.includes('auth_step_up_invalid') ||
    message.includes('auth_step_up_required')
  );
}
