import type { OcrProviderSpec, OcrSettingsView } from '#/api/ocr';

import { describe, expect, it } from 'vitest';

import {
  defaultOcrForm,
  formFromSettings,
  isTaskActive,
  modelStateColor,
  modelStateLabel,
  ocrMenuRoute,
  providerOptions,
  settingsPayload,
  validateOcrForm,
} from '../../data';

const providers: OcrProviderSpec[] = [
  {
    description: '本地模型',
    fields: [
      { label: '模型目录', name: 'model_dir', required: true, secret: false },
    ],
    kind: 'local_paddle',
    label: '本地 Paddle OCR',
    requires_credential: false,
  },
  {
    description: 'OpenAI 兼容',
    fields: [
      {
        label: 'Base URL',
        name: 'openai_base_url',
        required: true,
        secret: false,
      },
      { label: '模型', name: 'openai_model', required: true, secret: false },
      {
        label: '凭证编码',
        name: 'openai_credential_code',
        required: true,
        secret: true,
      },
    ],
    kind: 'openai_vision',
    label: 'OpenAI Vision',
    requires_credential: true,
  },
];

describe('ocr 管理端数据工具', () => {
  it('声明参数模块智能能力菜单目标', () => {
    expect(ocrMenuRoute).toEqual({
      component: '/param/ocr/index',
      group: '智能能力',
      path: '/param/ocr',
      title: '图片 OCR',
    });
  });

  it('按本地/AI 分段过滤 provider', () => {
    expect(providerOptions(providers, 'local')).toEqual([
      { label: '本地 Paddle OCR', value: 'local_paddle' },
    ]);
    expect(providerOptions(providers, 'ai')).toEqual([
      { label: 'OpenAI Vision', value: 'openai_vision' },
    ]);
  });

  it('从后端 flat 设置解码并编码 flat payload', () => {
    const settings: Partial<OcrSettingsView> = {
      default_provider: 'openai_vision',
      enabled: true,
      gemini_base_url: 'https://gemini.example.com',
      gemini_credential_code: 'gemini-cred',
      gemini_model: 'gemini-2.5-flash',
      model_dir: ' /srv/ocr ',
      openai_base_url: ' https://api.example.com ',
      openai_credential_code: ' cred-1 ',
      openai_model: ' gpt-4o-mini ',
      timeout_seconds: 60,
    };

    const form = formFromSettings(settings);
    expect(form.mode).toBe('ai');
    expect(settingsPayload(form, settings)).toEqual({
      default_provider: 'openai_vision',
      enabled: true,
      gemini_base_url: 'https://gemini.example.com',
      gemini_credential_code: 'gemini-cred',
      gemini_model: 'gemini-2.5-flash',
      model_dir: '/srv/ocr',
      openai_base_url: 'https://api.example.com',
      openai_credential_code: 'cred-1',
      openai_model: 'gpt-4o-mini',
      timeout_seconds: 60,
    });
  });

  it('校验当前模式必填字段', () => {
    const localForm = defaultOcrForm();
    localForm.enabled = true;
    expect(validateOcrForm(localForm, providers)).toBe('请填写本地模型目录');

    const aiForm = defaultOcrForm();
    aiForm.enabled = true;
    aiForm.mode = 'ai';
    aiForm.ai_provider = 'openai_vision';
    aiForm.ai_model = 'gpt-4o-mini';
    aiForm.ai_base_url = 'https://api.example.com';
    expect(validateOcrForm(aiForm, providers)).toBe('请选择凭证');
    aiForm.ai_credential_code = 'cred-1';
    expect(validateOcrForm(aiForm, providers)).toBeUndefined();
  });

  it('模型状态和任务状态使用明确标签', () => {
    expect(modelStateLabel('ready')).toBe('已就绪');
    expect(modelStateLabel('checksum_mismatch')).toBe('校验异常');
    expect(modelStateColor('missing')).toBe('warning');
    expect(isTaskActive('running')).toBe(true);
    expect(isTaskActive('succeeded')).toBe(false);
  });
});
