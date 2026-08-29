<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';
import type { Recordable } from '@vben/types';

import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { AuthenticationLogin, z } from '@vben/common-ui';
import { SvgDingDingIcon } from '@vben/icons';
import { $t } from '@vben/locales';

import { Button, message, Select } from 'antdv-next';

import { DingTalkApi } from '#/api';
import { useAuthStore } from '#/store';

import {
  getDingTalkExchangeCode,
  stripDingTalkExchangeCode,
} from './dingtalk-exchange-code';
import TotpLogin from './modules/totp-login.vue';

defineOptions({ name: 'Login', inheritAttrs: false });

const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

const dingtalkApps = ref<Awaited<ReturnType<typeof DingTalkApi.apps>>>([]);
const selectedDingtalkAppKey = ref<string>();

const visibleDingtalkApps = computed(() => dingtalkApps.value);
const showDingtalkSelect = computed(() => visibleDingtalkApps.value.length > 1);
const hasDingtalkLogin = computed(() => visibleDingtalkApps.value.length > 0);

const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      component: 'VbenInput',
      componentProps: {
        placeholder: $t('authentication.usernameTip'),
      },
      fieldName: 'username',
      label: $t('authentication.username'),
      rules: z.string().min(1, { message: $t('authentication.usernameTip') }),
    },
    {
      component: 'VbenInputPassword',
      componentProps: {
        placeholder: $t('authentication.password'),
      },
      fieldName: 'password',
      label: $t('authentication.password'),
      rules: z.string().min(1, { message: $t('authentication.passwordTip') }),
    },
  ];
});

function currentLoginUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete('exchange_code');
  return url.toString();
}

function selectedAppKey() {
  if (visibleDingtalkApps.value.length <= 1) {
    return undefined;
  }
  return selectedDingtalkAppKey.value;
}

async function loadDingTalkApps() {
  try {
    dingtalkApps.value = await DingTalkApi.apps();
    const defaultApp = dingtalkApps.value.find((app) => app.is_default);
    selectedDingtalkAppKey.value =
      defaultApp?.app_key ?? dingtalkApps.value[0]?.app_key;
  } catch {
    // 未配置钉钉时不影响本地账号密码登录。
    dingtalkApps.value = [];
  }
}

async function exchangeDingTalkCode() {
  const exchange_code = getDingTalkExchangeCode(
    route.query,
    window.location.href,
  );
  if (!exchange_code) return;

  try {
    const { exchange_code: _exchange_code, ...query } = route.query;
    if (_exchange_code !== undefined) {
      await router.replace({ path: route.path, query });
    }
    if (new URL(window.location.href).searchParams.has('exchange_code')) {
      window.history.replaceState(
        window.history.state,
        document.title,
        stripDingTalkExchangeCode(window.location.href),
      );
    }
    await authStore.authDingTalkExchange(exchange_code);
  } catch (error) {
    console.error(error);
    message.error('钉钉登录失败，请重新发起登录');
  }
}

function onDingTalkLogin() {
  window.location.href = DingTalkApi.loginUrl(
    selectedAppKey(),
    currentLoginUrl(),
  );
}

async function onSubmit(params: Recordable<any>) {
  await authStore.authLogin(params);
}

onMounted(async () => {
  await Promise.all([loadDingTalkApps(), exchangeDingTalkCode()]);
});
</script>

<template>
  <div v-bind="$attrs">
    <TotpLogin />
    <AuthenticationLogin
      :form-schema="formSchema"
      :loading="authStore.loginLoading"
      :show-code-login="false"
      :show-forget-password="false"
      :show-qrcode-login="false"
      :show-register="false"
      :show-third-party-login="false"
      @submit="onSubmit"
    >
      <template #title>
        <header
          class="mb-6 text-left sm:text-center"
          aria-labelledby="login-title"
        >
          <h1
            id="login-title"
            class="text-2xl font-semibold tracking-tight text-foreground"
          >
            账号登录
          </h1>
        </header>
      </template>
      <template #third-party-login>
        <div v-if="hasDingtalkLogin" class="mt-6 space-y-3">
          <div class="flex items-center justify-between" aria-hidden="true">
            <span
              class="w-[35%] border-b border-input dark:border-gray-600"
            ></span>
            <span class="text-center text-xs text-muted-foreground uppercase">
              钉钉登录
            </span>
            <span
              class="w-[35%] border-b border-input dark:border-gray-600"
            ></span>
          </div>

          <Select
            v-if="showDingtalkSelect"
            v-model:value="selectedDingtalkAppKey"
            :options="
              visibleDingtalkApps.map((app) => ({
                label: app.app_name,
                value: app.app_key,
              }))
            "
            class="w-full"
            placeholder="请选择钉钉应用"
          />

          <Button
            class="w-full justify-center"
            :disabled="authStore.loginLoading"
            type="primary"
            @click="onDingTalkLogin"
          >
            <SvgDingDingIcon class="size-4" />
            使用钉钉登录
          </Button>
        </div>
      </template>
    </AuthenticationLogin>
  </div>
</template>
