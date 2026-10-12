<script setup lang="ts">
import { Page } from '@vben/common-ui';

import GrantManager from '../download-authorizations/modules/grant-manager.vue';
</script>
<template>
  <Page
    title="交付授权维护"
    description="按制作项目、版本、材料模块和用户维护交付下载权限。"
  >
    <GrantManager delivery />
  </Page>
</template>
