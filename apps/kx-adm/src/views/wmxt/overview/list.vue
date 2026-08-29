<script lang="ts" setup>
import type { WmxtAdminHomeStats } from '#/api/wmxt';

import { onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Card, Statistic } from 'antdv-next';

import { WmxtAdminApi } from '#/api/wmxt';

import { statLabels } from './data';

const stats = ref<WmxtAdminHomeStats>();
const loading = ref(true);

onMounted(async () => {
  try {
    stats.value = await WmxtAdminApi.home_stats();
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <header class="page-heading"><h1>WMXT 总览</h1></header>
    <div
      class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
    >
      <Card
        v-for="[field, label] in statLabels"
        :key="field"
        :loading="loading"
        size="small"
      >
        <Statistic :title="label" :value="Number(stats?.[field] ?? 0)" />
      </Card>
    </div>
  </Page>
</template>
