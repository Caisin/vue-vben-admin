<script setup lang="ts">
import { Page } from '@vben/common-ui';

import GrantManager from './modules/grant-manager.vue';
</script>
<template>
  <Page
    title="授权维护"
    description="按作品、用户、有效期查找授权，支持行内调整与批量维护。"
  >
    <GrantManager />
  </Page>
</template>
