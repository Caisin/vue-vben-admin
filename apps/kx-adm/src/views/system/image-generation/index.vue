<script setup lang="ts">
import { Page } from '@vben/common-ui';

import ImageGenerationSettings from '#/desktop/image-generation-settings.vue';
</script>

<template>
  <Page title="GPT 生图配置" description="配置原生 image_gen 使用的本机 Skill">
    <ImageGenerationSettings />
  </Page>
</template>
