import type {
  OcrMode,
  OcrModelState,
  OcrProviderKind,
  OcrProviderSpec,
  OcrSettingsView,
  OcrSettingsWrite,
} from '#/api/ocr';

export interface OcrFormState {
  ai_base_url: string;
  ai_credential_code: string;
  ai_model: string;
  ai_provider: '' | OcrProviderKind;
  enabled: boolean;
  local_model_dir: string;
  mode: OcrMode;
  timeout_seconds: number;
}

export const ocrMenuRoute = {
  component: '/param/ocr/index',
  group: '智能能力',
  path: '/param/ocr',
  title: '图片 OCR',
} as const;

export function providerMode(kind: OcrProviderKind): OcrMode {
  return kind === 'local_paddle' ? 'local' : 'ai';
}

export function defaultProviderForMode(
  providers: OcrProviderSpec[],
  mode: OcrMode,
) {
  return providers.find((item) => providerMode(item.kind) === mode)?.kind;
}

export function defaultOcrForm(): OcrFormState {
  return {
    ai_base_url: '',
    ai_credential_code: '',
    ai_model: '',
    ai_provider: 'openai_vision',
    enabled: false,
    local_model_dir: '',
    mode: 'local',
    timeout_seconds: 120,
  };
}

export function formFromSettings(
  settings?: Partial<OcrSettingsView>,
): OcrFormState {
  const defaultProvider = settings?.default_provider ?? 'local_paddle';
  const openaiSelected = defaultProvider === 'openai_vision';
  const geminiSelected = defaultProvider === 'gemini_vision';
  return {
    ai_base_url: geminiSelected
      ? (settings?.gemini_base_url ?? '')
      : (settings?.openai_base_url ?? ''),
    ai_credential_code: geminiSelected
      ? (settings?.gemini_credential_code ?? '')
      : (settings?.openai_credential_code ?? ''),
    ai_model: geminiSelected
      ? (settings?.gemini_model ?? '')
      : (settings?.openai_model ?? ''),
    ai_provider:
      openaiSelected || geminiSelected ? defaultProvider : 'openai_vision',
    enabled: settings?.enabled ?? false,
    local_model_dir: settings?.model_dir ?? '',
    mode: providerMode(defaultProvider),
    timeout_seconds: Number(settings?.timeout_seconds ?? 120),
  };
}

export function settingsPayload(
  form: OcrFormState,
  settings?: Partial<OcrSettingsView>,
): OcrSettingsWrite {
  const provider: OcrProviderKind =
    form.mode === 'local'
      ? 'local_paddle'
      : form.ai_provider || 'openai_vision';
  return {
    default_provider: provider,
    enabled: Boolean(form.enabled),
    gemini_base_url:
      provider === 'gemini_vision'
        ? form.ai_base_url.trim()
        : (settings?.gemini_base_url ?? '').trim(),
    gemini_credential_code:
      provider === 'gemini_vision'
        ? form.ai_credential_code.trim()
        : (settings?.gemini_credential_code ?? '').trim(),
    gemini_model:
      provider === 'gemini_vision'
        ? form.ai_model.trim()
        : (settings?.gemini_model ?? '').trim(),
    model_dir: form.local_model_dir.trim(),
    openai_base_url:
      provider === 'openai_vision'
        ? form.ai_base_url.trim()
        : (settings?.openai_base_url ?? '').trim(),
    openai_credential_code:
      provider === 'openai_vision'
        ? form.ai_credential_code.trim()
        : (settings?.openai_credential_code ?? '').trim(),
    openai_model:
      provider === 'openai_vision'
        ? form.ai_model.trim()
        : (settings?.openai_model ?? '').trim(),
    timeout_seconds: Number(form.timeout_seconds || 120),
  };
}

export function validateOcrForm(
  form: OcrFormState,
  providers: OcrProviderSpec[],
): string | undefined {
  if (!form.enabled) return undefined;
  if (form.mode === 'local') {
    const localProvider = providers.find(
      (item) => item.kind === 'local_paddle',
    );
    if (localProvider?.available === false) {
      return localProvider.unavailable_reason || '本地 OCR 运行时不可用';
    }
    if (!form.local_model_dir.trim()) return '请填写本地模型目录';
    return undefined;
  }
  const provider = providers.find((item) => item.kind === form.ai_provider);
  if (!provider) return '请选择 AI Provider';
  if (
    provider.fields.some(
      (item) => item.name.endsWith('_base_url') && item.required,
    ) &&
    !form.ai_base_url.trim()
  ) {
    return '请填写 API 地址';
  }
  if (
    provider.fields.some(
      (item) => item.name.endsWith('_model') && item.required,
    ) &&
    !form.ai_model.trim()
  ) {
    return '请填写模型名称';
  }
  if (provider.requires_credential && !form.ai_credential_code.trim()) {
    return '请选择凭证';
  }
  return undefined;
}

export function modeOptions() {
  return [
    { label: '本地模型', value: 'local' },
    { label: 'AI 大模型', value: 'ai' },
  ];
}

export function providerOptions(providers: OcrProviderSpec[], mode: OcrMode) {
  return providers
    .filter((item) => providerMode(item.kind) === mode)
    .map((item) => ({ label: item.label, value: item.kind }));
}

export function modelStateLabel(state?: OcrModelState) {
  if (state === 'ready') return '已就绪';
  if (state === 'missing') return '缺失';
  if (state === 'invalid_dir') return '目录无效';
  if (state === 'invalid_file') return '路径错误';
  if (state === 'checksum_mismatch') return '校验异常';
  return '未知';
}

export function modelStateColor(state?: OcrModelState) {
  if (state === 'ready') return 'success';
  if (state === 'missing') return 'warning';
  if (state === 'invalid_dir' || state === 'invalid_file') return 'error';
  if (state === 'checksum_mismatch') return 'error';
  return 'default';
}

export function isTaskActive(status?: string) {
  return ['queued', 'retrying', 'running'].includes(status ?? '');
}
