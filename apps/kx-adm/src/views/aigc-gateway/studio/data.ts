import type {
  GenerateOptions,
  StudioKind,
  StudioModel,
  StudioRun,
} from '#/api/aigc-gateway/studio';

export const names: Record<StudioKind, string> = {
  chat: '聊天',
  image: '图片创作',
  video: '视频创作',
};
export const states: Record<string, string> = {
  pending: '排队中',
  submitting: '提交中',
  running: '生成中',
  succeeded: '已完成',
  failed: '失败',
  cancelled: '已停止',
  unknown: '提交结果待核实',
};
export function isActive(state: string) {
  return ['pending', 'running', 'submitting'].includes(state);
}
export function canResume(run: StudioRun) {
  if (run.state === 'pending')
    return !run.task_run_id && Date.now() / 1000 - Number(run.created_at) >= 30;
  return (
    ['cancelled', 'failed', 'unknown'].includes(run.state) &&
    Boolean(
      run.upstream_id ||
      [
        'aigc_studio_dispatch_failed',
        'aigc_studio_file_binding_failed',
      ].includes(run.error_code),
    )
  );
}
export function errorText(code: string) {
  const errors: Record<string, string> = {
    aigc_studio_attachment_unavailable:
      '附件不存在或当前账号没有访问权限，请移除不可用附件并重新上传。',
    storage_file_not_found:
      '附件不存在或当前账号没有访问权限，请检查本轮及历史消息中的附件。',
    aigc_studio_execution_failed: '任务执行失败，请联系管理员核查任务记录。',
    aigc_studio_file_binding_failed: '附件引用保存失败，可以恢复原任务。',
    aigc_studio_file_content_invalid:
      '附件内容与文件格式不符，请重新上传有效文件。',
    aigc_studio_file_type_unsupported:
      '附件格式不支持，请上传 PNG、JPEG、WebP 图片或支持的视频。',
    aigc_studio_file_too_large: '附件总大小超过限制，最多支持 24 MiB。',
    aigc_studio_private_storage_required: '素材与生成结果必须使用私有存储。',
    aigc_studio_response_invalid:
      '供应商响应格式无效，请联系管理员检查模型接口。',
    aigc_studio_upstream_unavailable: '供应商暂时无法连接，请稍后重试。',
    aigc_studio_upstream_unauthorized:
      '供应商凭证失效或没有模型权限，请联系管理员检查凭证和授权。',
    aigc_studio_balance_insufficient: '供应商账户余额不足。',
    aigc_studio_upstream_model_missing:
      '供应商模型或接口不存在，请检查模型路由。',
    aigc_studio_rate_limited: '供应商限流，请稍后重新生成。',
    aigc_studio_submission_unknown:
      '上游可能已受理，已暂停自动重试以避免重复计费。请核实供应商记录。',
    aigc_studio_stream_interrupted: '回复中断，已保留部分内容。',
    aigc_studio_response_incomplete:
      '供应商未完成回复，可能达到输出上限或内容限制，已保留部分内容。',
    aigc_studio_upstream_rejected:
      '供应商拒绝请求，请检查模型参数、账户额度或内容限制。',
    aigc_studio_generation_failed: '供应商生成失败，请检查素材与内容限制。',
    aigc_studio_dispatch_failed: '任务调度失败，可以恢复执行。',
    aigc_studio_attachment_unsupported: '当前模型不支持所选附件类型。',
    aigc_studio_context_limit: '当前会话上下文已达上限，请新建会话。',
    aigc_studio_model_changed: '模型配置已变更，无法在原供应商恢复此任务。',
    aigc_studio_timeout: '等待超时；已取得视频编号的任务可恢复查询。',
    aigc_studio_result_download_failed: '生成结果下载失败，可恢复原视频任务。',
    aigc_studio_result_missing: '供应商没有返回有效媒体结果。',
    aigc_studio_result_invalid: '供应商返回的文件格式无效。',
    aigc_studio_cancelled: '已停止等待，上游可能继续生成或计费。',
  };
  return errors[code] ?? (code ? `任务未完成：${code}` : '');
}
export function runErrorText(run: Pick<StudioRun, 'error_code' | 'state'>) {
  return (
    errorText(run.error_code) ||
    (['failed', 'unknown'].includes(run.state)
      ? '该记录未记录具体错误原因，请联系管理员核查任务记录。'
      : '')
  );
}
export function accepts(model?: StudioModel, kind: StudioKind = 'chat') {
  return [
    ...(model?.capabilities.includes('input_image')
      ? ['image/png', 'image/jpeg', 'image/webp']
      : []),
    ...(kind !== 'image' && model?.capabilities.includes('input_video')
      ? ['video/mp4', 'video/quicktime', 'video/webm']
      : []),
  ];
}
export function cleanOptions(
  kind: StudioKind,
  protocol: string,
  options: GenerateOptions,
): GenerateOptions {
  if (kind === 'chat')
    return { max_tokens: options.max_tokens, temperature: options.temperature };
  if (kind === 'image')
    return protocol === 'gemini'
      ? {}
      : { count: options.count, quality: options.quality, size: options.size };
  return ['byteplus_jimeng', 'gemini', 'volc_jimeng'].includes(protocol)
    ? { seconds: options.seconds, aspect_ratio: options.aspect_ratio }
    : { seconds: options.seconds, size: options.size };
}
