<script lang="ts" setup>
import { AuthPageLayout } from '@vben/layouts';

import { systemSettingsState } from '#/system-settings-init';

const {
  appName,
  copyrightText,
  logo,
  pageDescription,
  pageTitle,
  sloganImage,
} = systemSettingsState;
const clickLogo = () => {};
</script>

<template>
  <AuthPageLayout
    :app-name="appName"
    :page-description="pageDescription"
    :page-title="pageTitle"
    :slogan-image="sloganImage"
    :logo="logo"
    :click-logo="clickLogo"
  >
    <template #logo>
      <div
        class="absolute top-4 left-4 z-10 flex items-center text-foreground"
        @click="clickLogo"
      >
        <img :alt="appName" :src="logo" class="size-[42px] object-contain" />
        <span class="ml-2 hidden text-xl font-medium sm:inline">
          {{ appName }}
        </span>
      </div>
    </template>
    <template v-if="copyrightText" #copyright>
      <div class="text-center text-xs text-muted-foreground">
        {{ copyrightText }}
      </div>
    </template>
    <!-- 自定义工具栏 -->
    <!-- <template #toolbar></template> -->
  </AuthPageLayout>
</template>
