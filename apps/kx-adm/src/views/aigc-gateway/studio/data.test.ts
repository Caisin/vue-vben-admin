import { describe, expect, it } from 'vitest';

import {
  accepts,
  cleanOptions,
  errorText,
  isActive,
  runErrorText,
} from './data';

describe('创作工作台契约', () => {
  it('受理和生成中不能作为成功终态', () => {
    for (const state of ['pending', 'submitting', 'running'])
      expect(isActive(state)).toBe(true);
    for (const state of ['succeeded', 'failed', 'cancelled', 'unknown'])
      expect(isActive(state)).toBe(false);
  });
  it('不猜测模型的附件能力', () => {
    expect(accepts()).toEqual([]);
    expect(
      accepts({
        id: 1,
        name: 'text',
        provider: 'test',
        protocol: 'gemini',
        capabilities: ['chat', 'input_video'],
        input_price: '0',
        output_price: '0',
      }),
    ).toEqual(['video/mp4', 'video/quicktime', 'video/webm']);
  });
  it('不同菜单不泄漏其它模式的参数', () => {
    const options = {
      max_tokens: 4096,
      seconds: 8,
      size: '1280x720',
      count: 4,
      aspect_ratio: '16:9',
    };
    expect(cleanOptions('chat', 'openai', options)).toEqual({
      max_tokens: 4096,
      temperature: undefined,
    });
    expect(cleanOptions('video', 'gemini', options)).toEqual({
      seconds: 8,
      aspect_ratio: '16:9',
    });
    expect(cleanOptions('image', 'gemini', options)).toEqual({});
  });
  it('不把未知提交误报为安全重试或免费取消', () => {
    expect(errorText('aigc_studio_submission_unknown')).toContain('重复计费');
    expect(errorText('aigc_studio_cancelled')).toContain('计费');
    expect(errorText('aigc_studio_response_incomplete')).toContain(
      '未完成回复',
    );
    expect(errorText('aigc_studio_response_incomplete')).toContain(
      '已保留部分内容',
    );
  });
  it('附件不可用给出处理方法，失败记录缺少错误码也有说明', () => {
    expect(errorText('aigc_studio_attachment_unavailable')).toContain(
      '重新上传',
    );
    expect(errorText('storage_file_not_found')).toContain('访问权限');
    expect(runErrorText({ state: 'failed', error_code: '' })).toContain(
      '未记录',
    );
    expect(runErrorText({ state: 'succeeded', error_code: '' })).toBe('');
    expect(
      runErrorText({ state: 'failed', error_code: 'aigc_studio_rate_limited' }),
    ).toContain('限流');
  });
});
