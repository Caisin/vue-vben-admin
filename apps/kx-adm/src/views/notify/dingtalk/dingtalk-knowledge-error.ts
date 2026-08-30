import { requestErrorMessage } from '#/request-errors';

export function dingtalkKnowledgeError(error: unknown) {
  const detail = requestErrorMessage(error, '知识库加载失败，请稍后重试');
  const link = detail.match(/https:\/\/[^\s，。；;]+/)?.[0] ?? '';
  return {
    detail,
    link,
    message: detail.includes('Wiki.Workspace.Read')
      ? '当前钉钉应用未开通知识库读取权限，请开通 Wiki.Workspace.Read 后重试。'
      : '知识库加载失败，请根据钉钉返回信息检查应用权限和操作人权限。',
  };
}
