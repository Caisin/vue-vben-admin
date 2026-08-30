import { describe, expect, it } from 'vitest';

import { dingtalkKnowledgeError } from '../../src/views/notify/dingtalk/dingtalk-knowledge-error';

describe('dingtalk knowledge errors', () => {
  it('keeps the original DingTalk diagnostics with an actionable permission message', () => {
    const detail =
      '钉钉 API 调用失败: operation=获取知识库列表, status=403 Forbidden, code=Forbidden.AccessDenied.AccessTokenPermissionDenied, request_id=request-123, message=应用尚未开通所需的权限：[Wiki.Workspace.Read]，申请地址：https://open-dev.dingtalk.com/appscope/apply?content=app%23Wiki.Workspace.Read';

    expect(dingtalkKnowledgeError({ msg: detail })).toEqual({
      detail,
      link: 'https://open-dev.dingtalk.com/appscope/apply?content=app%23Wiki.Workspace.Read',
      message:
        '当前钉钉应用未开通知识库读取权限，请开通 Wiki.Workspace.Read 后重试。',
    });
  });

  it('keeps other platform diagnostics visible', () => {
    expect(dingtalkKnowledgeError({ msg: '操作人无权访问该知识库' })).toEqual({
      detail: '操作人无权访问该知识库',
      link: '',
      message: '知识库加载失败，请根据钉钉返回信息检查应用权限和操作人权限。',
    });
  });
});
