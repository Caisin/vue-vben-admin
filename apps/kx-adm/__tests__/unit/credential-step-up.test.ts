import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { stepUp } = vi.hoisted(() => ({
  stepUp: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({
    currentRoute: { value: { path: '/' } },
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock('@vben/preferences', () => ({
  preferences: { app: { defaultHomePath: '/' } },
}));

vi.mock('@vben/stores', () => ({
  resetAllStores: vi.fn(),
  useAccessStore: () => ({
    loginExpired: false,
    setAccessCodes: vi.fn(),
    setAccessToken: vi.fn(),
    setLoginExpired: vi.fn(),
  }),
  useUserStore: () => ({ setUserInfo: vi.fn() }),
}));

vi.mock('#/auth', () => ({
  adminPasswordLoginRequest: vi.fn(),
}));

vi.mock('antdv-next', () => ({
  notification: { success: vi.fn() },
}));

vi.mock('#/api', () => ({
  AuthApi: {},
  DingTalkApi: {},
  MfaApi: { stepUp },
  isAuthBody: vi.fn(),
  isMfaLoginChallenge: vi.fn(),
  toAuthSession: vi.fn(),
}));

vi.mock('#/locales', () => ({
  $t: (key: string) => key,
}));

describe('credential step-up', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    stepUp.mockReset();
  });

  it('申请与凭证明文接口一致的 action', async () => {
    stepUp.mockResolvedValue({
      action: 'credential.reveal',
      expires_at: Math.floor(Date.now() / 1000) + 600,
      grant_token: 'grant-token',
    });
    const { useAuthStore } = await import('../../src/store/auth');

    await useAuthStore().authorizePrivacyReveal('123456');

    expect(stepUp).toHaveBeenCalledWith({
      action: 'credential.reveal',
      totp_code: '123456',
    });
  });
});
