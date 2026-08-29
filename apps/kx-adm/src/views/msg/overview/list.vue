<script lang="ts" setup>
import type { OverviewSearchValues } from './data';

import type { MsgOverviewView, OverviewMetric } from '#/api/msg';

import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import { Card, Tag } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { MsgOverviewApi } from '#/api/msg';

import { useFormSchema } from './data';

const router = useRouter();
const loading = ref(false);
const overview = ref<MsgOverviewView | null>(null);
const submittedFilters = ref<OverviewSearchValues>({
  expires_within_days: 30,
  low_balance_threshold: '10',
});

const [Form] = useVbenForm<OverviewSearchValues>({
  commonConfig: { componentProps: { class: 'w-full' } },
  handleSubmit: loadOverview,
  schema: useFormSchema(),
  showCollapseButton: true,
  submitButtonOptions: { content: '刷新统计' },
  wrapperClass: 'grid-cols-1 md:grid-cols-2',
});

const sections = [
  { key: 'devices', title: '设备状态' },
  { key: 'sim_cards', title: '号码资产' },
  { key: 'sms', title: '短信任务' },
  { key: 'events', title: '事件处理' },
] as const;

async function loadOverview(values: OverviewSearchValues) {
  submittedFilters.value = values;
  loading.value = true;
  try {
    overview.value = await MsgOverviewApi.get({
      expires_within_days: values.expires_within_days,
      low_balance_threshold: values.low_balance_threshold.trim() || '10',
    });
  } finally {
    loading.value = false;
  }
}

function metrics(key: (typeof sections)[number]['key']) {
  return overview.value?.[key] ?? [];
}

function levelLabel(level: string) {
  return (
    {
      default: '信息',
      error: '异常',
      success: '正常',
      warning: '预警',
    }[level] ?? level
  );
}

function levelColor(level: string) {
  return (
    {
      default: 'default',
      error: 'error',
      success: 'success',
      warning: 'warning',
    }[level] ?? 'default'
  );
}

function openMetric(metric: OverviewMetric) {
  const query = Object.fromEntries(
    Object.entries(metric.target_query ?? {}).map(([key, value]) => [
      key,
      value === undefined ? undefined : String(value),
    ]),
  );
  router.push({ path: metric.target_path, query });
}

onMounted(() => loadOverview(submittedFilters.value));
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <header class="page-heading">
      <div>
        <h1>消息总览</h1>
        <p>汇总设备、号码、短信和事件状态，点击统计卡片可进入对应明细筛选。</p>
      </div>
    </header>

    <Form class="overview-form" />

    <div class="overview-tip">
      当前低余额阈值：{{
        overview?.low_balance_threshold ??
        submittedFilters.low_balance_threshold
      }}； 有效期预警窗口：{{
        overview?.expires_within_days ?? submittedFilters.expires_within_days
      }}
      天。
    </div>

    <div class="overview-content" :class="{ loading }">
      <section
        v-for="section in sections"
        :key="section.key"
        class="metric-section"
      >
        <h2>{{ section.title }}</h2>
        <div class="metric-grid">
          <Card
            v-for="metric in metrics(section.key)"
            :key="metric.code"
            class="metric-card"
            hoverable
            size="small"
            @click="openMetric(metric)"
          >
            <div class="metric-header">
              <span>{{ metric.title }}</span>
              <Tag :color="levelColor(metric.level)">
                {{ levelLabel(metric.level) }}
              </Tag>
            </div>
            <div class="metric-value">{{ metric.value }}</div>
            <div class="metric-action">查看明细</div>
          </Card>
        </div>
      </section>
    </div>
  </Page>
</template>

<style scoped>
.management-page {
  min-height: 0;
}

.management-page :deep(.management-content) {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.page-heading {
  display: flex;
  flex: 0 0 auto;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.page-heading h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
}

.page-heading p,
.overview-tip,
.metric-action {
  color: hsl(var(--muted-foreground));
}

.page-heading p {
  margin: 4px 0 0;
}

.threshold-input {
  width: 150px;
}

.days-input {
  width: 170px;
}

.overview-tip {
  flex: 0 0 auto;
  padding: 10px 12px;
  margin-bottom: 12px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.overview-content {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.overview-content.loading {
  opacity: 0.65;
}

.metric-section + .metric-section {
  margin-top: 18px;
}

.metric-section h2 {
  margin: 0 0 10px;
  font-size: 16px;
  font-weight: 600;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.metric-card {
  cursor: pointer;
}

.metric-header {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  min-height: 24px;
}

.metric-value {
  margin-top: 12px;
  font-size: 30px;
  font-weight: 700;
  line-height: 1.1;
}

.metric-action {
  margin-top: 8px;
  font-size: 12px;
}

@media (max-width: 1400px) {
  .metric-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .page-heading {
    flex-direction: column;
    align-items: flex-start;
  }

  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .metric-grid {
    grid-template-columns: 1fr;
  }
}
</style>
