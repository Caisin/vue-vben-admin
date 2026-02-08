<script setup lang="ts">
import type { ThirdPartyLogin } from './types';

// import { useAppConfig } from '@vben/hooks';
// import { MdiGithub, MdiGoogle, MdiQqchat, MdiWechat } from '@vben/icons';
// import { useAppConfig } from '@vben/hooks';
// import {
//   SvgGithubIcon,
//   SvgGoogleIcon,
//   SvgQQChatIcon,
//   SvgWeChatIcon,
// } from '@vben/icons';
import { $t } from '@vben/locales';

import { VbenIconButton } from '@vben-core/shadcn-ui';

// import DingdingLogin from './dingding-login.vue';

defineOptions({
  name: 'ThirdPartyLogin',
});

defineProps<Props>();

// withDefaults(defineProps<Props>(), {
//   thirdPartyLogins: [
//     { name: 'github', icon: MdiGithub, tooltip: 'authentication.githubLogin' },
//   ] as ThirdPartyLogin[],
// });

interface Props {
  thirdPartyLogins?: ThirdPartyLogin[];
}

// const {
//   auth: { dingding: dingdingAuthConfig },
// } = useAppConfig(import.meta.env, import.meta.env.PROD);
</script>

<template>
  <div class="w-full sm:mx-auto md:max-w-md">
    <div class="mt-4 flex items-center justify-between">
      <span class="border-input w-[35%] border-b dark:border-gray-600"></span>
      <span class="text-muted-foreground text-center text-xs uppercase">
        {{ $t('authentication.thirdPartyLogin') }}
      </span>
      <span class="border-input w-[35%] border-b dark:border-gray-600"></span>
    </div>

    <div class="mt-4 flex flex-wrap justify-center">
      <VbenIconButton
        v-for="third in thirdPartyLogins"
        :key="third.name"
        :tooltip="third?.tooltip"
        tooltip-side="top"
        class="mb-3"
        @click="third.onClick"
      >
        <component :is="third.icon" />
      </VbenIconButton>
      <!-- <VbenIconButton
        :tooltip="$t('authentication.wechatLogin')"
        tooltip-side="top"
        class="mb-3"
      >
        <SvgWeChatIcon />
      </VbenIconButton>
      <VbenIconButton
        :tooltip="$t('authentication.qqLogin')"
        tooltip-side="top"
        class="mb-3"
      >
        <SvgQQChatIcon />
      </VbenIconButton>
      <VbenIconButton
        :tooltip="$t('authentication.githubLogin')"
        tooltip-side="top"
        class="mb-3"
      >
        <SvgGithubIcon />
      </VbenIconButton>
      <VbenIconButton
        :tooltip="$t('authentication.googleLogin')"
        tooltip-side="top"
        class="mb-3"
      >
        <SvgGoogleIcon />
      </VbenIconButton>
      <DingdingLogin
        v-if="dingdingAuthConfig"
        :corp-id="dingdingAuthConfig.corpId"
        :client-id="dingdingAuthConfig.clientId"
        class="mb-3"
      /> -->
    </div>
  </div>
</template>
