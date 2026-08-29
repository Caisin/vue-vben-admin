<script lang="ts" setup>
import type { MallDashboardView } from '#/api/mall';

import { onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Button, Card, Result, Spin, Statistic } from 'antdv-next';

import { MallAdminApi } from '#/api/mall';

import { dashboardCards } from './data';

const loading = ref(false);
const dashboard = ref<MallDashboardView>();
const error = ref(false);

async function loadDashboard() {
  loading.value = true;
  error.value = false;
  try {
    dashboard.value = await MallAdminApi.dashboard();
  } catch {
    error.value = true;
  } finally {
    loading.value = false;
  }
}

onMounted(loadDashboard);
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
    title="积分商城总览"
  >
    <Spin :spinning="loading">
      <Result
        v-if="error"
        class="section-card"
        status="warning"
        title="商城总览加载失败"
        sub-title="请确认 mall 数据源和 /mall/admin/dashboard 已可访问。"
      >
        <template #extra>
          <Button type="primary" @click="loadDashboard">重试</Button>
        </template>
      </Result>
      <div v-else class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Card
          v-for="card in dashboardCards(dashboard)"
          :key="card.label"
          class="section-card"
          size="small"
        >
          <Statistic
            :title="card.label"
            :value="card.value"
            :value-style="card.danger ? { color: '#cf1322' } : undefined"
          />
        </Card>
      </div>
    </Spin>
  </Page>
</template>
