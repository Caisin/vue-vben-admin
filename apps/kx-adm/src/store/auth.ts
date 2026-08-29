import type { Recordable, UserInfo } from '@vben/types';

import type { AuthBody, MfaLoginChallenge, StepUpGrantView } from '#/api/core';

import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { preferences } from '@vben/preferences';
import { resetAllStores, useAccessStore, useUserStore } from '@vben/stores';

import { notification } from 'antdv-next';
import { defineStore } from 'pinia';

import {
  AuthApi,
  DingTalkApi,
  isAuthBody,
  isMfaLoginChallenge,
  MfaApi,
  toAuthSession,
} from '#/api/core';
import { adminPasswordLoginRequest } from '#/auth';
import { $t } from '#/locales';

export const useAuthStore = defineStore('auth', () => {
  const accessStore = useAccessStore();
  const userStore = useUserStore();
  const router = useRouter();

  const loginLoading = ref(false);
  const privacyRevealGrant = ref<StepUpGrantView>();
  const pendingMfaLogin = ref<MfaLoginChallenge>();

  /**
   * 写入 Token 后拉取用户资料和权限码，建立前端登录态。
   */
  async function establishSession(
    accessToken: string,
    onSuccess?: () => Promise<void> | void,
  ) {
    let userInfo: null | UserInfo = null;

    if (!accessToken) {
      return { userInfo };
    }

    accessStore.setAccessToken(accessToken);

    const [fetchUserInfoResult, accessCodes] = await Promise.all([
      fetchUserInfo(),
      AuthApi.accessCodes(),
    ]);

    userInfo = fetchUserInfoResult;
    userStore.setUserInfo(userInfo);
    accessStore.setAccessCodes(accessCodes);

    if (accessStore.loginExpired) {
      accessStore.setLoginExpired(false);
    } else {
      onSuccess
        ? await onSuccess?.()
        : await router.push(
            userInfo.homePath || preferences.app.defaultHomePath,
          );
    }

    if (userInfo?.realName) {
      notification.success({
        description: `${$t('authentication.loginSuccessDesc')}:${userInfo.realName}`,
        duration: 3,
        title: $t('authentication.loginSuccess'),
      });
    }

    return { userInfo };
  }

  async function handleLoginResponse(
    body: AuthBody | MfaLoginChallenge,
    onSuccess?: () => Promise<void> | void,
  ) {
    if (isMfaLoginChallenge(body)) {
      if (router.currentRoute.value.path === LOGIN_PATH) {
        accessStore.setLoginExpired(false);
      }
      pendingMfaLogin.value = body;
      return { mfaRequired: true, userInfo: null };
    }

    if (!isAuthBody(body)) {
      throw new Error('未知登录响应');
    }

    pendingMfaLogin.value = undefined;
    const session = toAuthSession(body);
    return await establishSession(session.accessToken, onSuccess);
  }

  /**
   * 本地用户名密码登录。
   * @param params 登录表单数据
   * @param onSuccess 成功之后的回调函数
   */
  async function authLogin(
    params: Recordable<any>,
    onSuccess?: () => Promise<void> | void,
  ) {
    try {
      loginLoading.value = true;
      const body = await AuthApi.accessToken(
        adminPasswordLoginRequest(params.username, params.password),
      );
      return await handleLoginResponse(body, onSuccess);
    } finally {
      loginLoading.value = false;
    }
  }

  /**
   * 钉钉一次性交换码登录。
   */
  async function authDingTalkExchange(
    exchange_code: string,
    onSuccess?: () => Promise<void> | void,
  ) {
    try {
      loginLoading.value = true;
      const body = await DingTalkApi.exchange({ exchange_code });
      return await handleLoginResponse(body, onSuccess);
    } finally {
      loginLoading.value = false;
    }
  }

  /**
   * 完成已缓存登录 challenge 的 TOTP 校验。
   */
  async function completeMfaLogin(
    totp_code: string,
    onVerified?: () => Promise<void> | void,
  ) {
    if (!pendingMfaLogin.value) {
      throw new Error('二次验证会话已失效，请重新登录');
    }
    try {
      loginLoading.value = true;
      const body = await MfaApi.login({
        challenge_id: pendingMfaLogin.value.challenge_id,
        totp_code,
      });
      if (isAuthBody(body)) {
        // 验证成功后先让登录页关闭 MFA Teleport，再清空 challenge 并切换路由。
        await onVerified?.();
      }
      return await handleLoginResponse(body);
    } finally {
      loginLoading.value = false;
    }
  }

  function clearMfaLogin() {
    pendingMfaLogin.value = undefined;
  }

  function currentPrivacyRevealGrant() {
    const grant = privacyRevealGrant.value;
    if (!grant || Number(grant.expires_at) <= Math.floor(Date.now() / 1000)) {
      privacyRevealGrant.value = undefined;
      return undefined;
    }
    return grant;
  }

  async function authorizePrivacyReveal(totp_code: string) {
    const current = currentPrivacyRevealGrant();
    if (current) return current;
    const grant = await MfaApi.stepUp({
      action: 'credential.reveal',
      totp_code,
    });
    privacyRevealGrant.value = grant;
    return grant;
  }

  /** 一次性高危动作授权不进入 store，调用方提交后必须立即丢弃 grant。 */
  function authorizeStepUp(action: string, totp_code: string) {
    return MfaApi.stepUp({ action, totp_code });
  }

  function clearPrivacyRevealGrant() {
    privacyRevealGrant.value = undefined;
  }

  const isLoggingOut = ref(false); // 正在 logout 标识, 防止 /logout 死循环.

  async function logout(redirect: boolean = true) {
    if (isLoggingOut.value) return;
    isLoggingOut.value = true;
    accessStore.setLoginExpired(false);

    try {
      try {
        await AuthApi.logout();
      } catch {
        // 登出失败时仍清理本地登录态。
      }

      resetAllStores();
      accessStore.setLoginExpired(false);
      pendingMfaLogin.value = undefined;
      privacyRevealGrant.value = undefined;

      await router.replace({
        path: LOGIN_PATH,
        query: redirect
          ? {
              redirect: encodeURIComponent(router.currentRoute.value.fullPath),
            }
          : {},
      });
    } finally {
      // 在路由离开业务布局前保持退出标记，阻止在途 401 请求重新打开过期登录弹窗。
      isLoggingOut.value = false;
    }
  }

  async function fetchUserInfo() {
    const userInfo = await AuthApi.userInfo();
    userStore.setUserInfo(userInfo);
    return userInfo;
  }

  function $reset() {
    loginLoading.value = false;
    pendingMfaLogin.value = undefined;
    privacyRevealGrant.value = undefined;
  }

  return {
    $reset,
    authDingTalkExchange,
    authLogin,
    authorizePrivacyReveal,
    authorizeStepUp,
    clearPrivacyRevealGrant,
    clearMfaLogin,
    completeMfaLogin,
    currentPrivacyRevealGrant,
    establishSession,
    fetchUserInfo,
    isLoggingOut,
    loginLoading,
    logout,
    pendingMfaLogin,
  };
});
