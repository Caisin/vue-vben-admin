<script setup lang="ts">
import type { DownloadStats } from '#/api/res/downloads';

import { computed, ref, watch } from 'vue';

import {
  Alert,
  Button,
  Card,
  DatePicker,
  Empty,
  Select,
  Spin,
  Statistic,
  Table,
} from 'antdv-next';
import dayjs from 'dayjs';

import { ResDownloadApi } from '#/api/res/downloads';
import { formatFileSize } from '#/components/file-picker/internal/file-picker-options';
import { requestErrorMessage } from '#/request-errors';

const props = defineProps<{
  uid?: number | string;
  resId?: number | string;
  resourceCode?: number | string;
}>();
const period = ref(7);
const range = ref<[dayjs.Dayjs, dayjs.Dayjs]>();
const stats = ref<DownloadStats>();
const loading = ref(false);
const errorText = ref('');
let revision = 0;
const cards = computed(
  () =>
    [
      ['下载任务数', stats.value?.total_tasks ?? 0],
      ['已完成任务', stats.value?.completed_tasks ?? 0],
      ['失败任务', stats.value?.failed_tasks ?? 0],
      ['待下载 / 下载中', stats.value?.active_tasks ?? 0],
      ['成功文件数', stats.value?.total_downloads ?? 0],
      ['下载用户数', stats.value?.unique_users ?? 0],
      ['来源 IP 数', stats.value?.unique_ips ?? 0],
      ['成功下载流量', formatFileSize(stats.value?.total_bytes ?? 0)],
    ] as const,
);
const rankings = computed(() => [
  {
    title: '剧目排行',
    rows: (stats.value?.ranking ?? []).map((r) => ({
      key: String(r.res_id),
      label: r.resource_name,
      download_count: r.download_count,
      bytes: r.bytes,
    })),
  },
  { title: '用户排行', rows: stats.value?.user_ranking ?? [] },
  { title: 'IP 排行', rows: stats.value?.ip_ranking ?? [] },
  { title: '客户端排行', rows: stats.value?.client_ranking ?? [] },
]);
const columns = [
  { title: '名称', dataIndex: 'label', key: 'label', ellipsis: true },
  { title: '成功文件', dataIndex: 'download_count', key: 'count', width: 100 },
  { title: '流量', key: 'bytes', width: 120 },
];
const maxDaily = computed(() =>
  Math.max(1, ...(stats.value?.daily ?? []).map((r) => r.download_count)),
);
function date(key: string) {
  return new Date((Number(key) + 28_800) * 1000).toISOString().slice(0, 10);
}
async function load() {
  const request = ++revision;
  if (period.value === 0 && (!range.value?.[0] || !range.value?.[1])) {
    stats.value = undefined;
    loading.value = false;
    return;
  }
  loading.value = true;
  errorText.value = '';
  // 快捷范围固定北京时间自然日，不受操作者电脑时区影响。
  const selectedRange = range.value;
  const now = Math.floor(Date.now() / 1000);
  const today = Math.floor((now + 28_800) / 86_400) * 86_400 - 28_800;
  const from = period.value
    ? today - (period.value - 1) * 86_400
    : Math.floor(
        Date.parse(
          `${selectedRange?.[0].format('YYYY-MM-DD')}T00:00:00+08:00`,
        ) / 1000,
      );
  const to = period.value
    ? now
    : Math.floor(
        Date.parse(
          `${selectedRange?.[1].format('YYYY-MM-DD')}T23:59:59+08:00`,
        ) / 1000,
      );
  try {
    const result = await ResDownloadApi.stats({
      from,
      to,
      limit: 10,
      uid: props.uid ? Number(props.uid) : undefined,
      res_id: props.resId ? Number(props.resId) : undefined,
      resource_code: props.resourceCode
        ? String(props.resourceCode)
        : undefined,
    });
    if (request === revision) stats.value = result;
  } catch (error) {
    if (request === revision) {
      stats.value = undefined;
      errorText.value = requestErrorMessage(error, '加载下载统计失败');
    }
  } finally {
    if (request === revision) loading.value = false;
  }
}
watch(
  [() => props.uid, () => props.resId, () => props.resourceCode, period, range],
  load,
  { immediate: true },
);
</script>
<template>
  <Card title="下载看板" class="mb-4">
    <template #extra>
      <div class="flex flex-wrap items-center gap-2">
        <label for="download-stats-period" class="sr-only">统计时间范围</label>
        <Select
          id="download-stats-period"
          v-model:value="period"
          aria-label="统计时间范围"
          class="w-32"
          :options="[
            { label: '今天', value: 1 },
            { label: '近 7 天', value: 7 },
            { label: '近 30 天', value: 30 },
            { label: '自定义', value: 0 },
          ]"
        />
        <DatePicker.RangePicker v-if="period === 0" v-model:value="range" />
        <Button :loading="loading" @click="load">刷新看板</Button>
      </div>
    </template>
    <p class="mb-3 text-sm text-muted-foreground">
      北京时间统计，随剧名、编码及下载人筛选。任务按开始时间统计；文件及流量仅计成功下载，重复下载按次累计。排行按成功文件数降序，最多显示
      10 项。
    </p>
    <Alert
      v-if="errorText"
      type="error"
      :message="errorText"
      show-icon
      class="mb-3"
    />
    <Spin :spinning="loading">
      <template v-if="stats">
        <div class="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Statistic
            v-for="[title, value] in cards"
            :key="title"
            :title="title"
            :value="value"
          />
        </div>
        <Card title="每日成功下载趋势" size="small" class="mb-4">
          <div
            class="flex gap-2 overflow-x-auto pb-2"
            aria-label="每日成功下载趋势"
          >
            <div
              v-for="row in stats.daily"
              :key="row.key"
              class="min-w-20 flex-1 text-center text-xs"
              :title="`${date(row.key)}：${row.download_count} 个文件，${formatFileSize(row.bytes)}`"
            >
              <span>{{ row.download_count }}</span>
              <div class="mt-1 flex h-20 items-end justify-center">
                <div
                  class="w-8 rounded-t bg-primary"
                  :style="{
                    height: `${Math.max(row.download_count ? 2 : 0, (row.download_count / maxDaily) * 100)}%`,
                  }"
                ></div>
              </div>
              <div class="mt-1">{{ date(row.key).slice(5) }}</div>
              <div>{{ formatFileSize(row.bytes) }}</div>
            </div>
          </div>
        </Card>
        <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card
            v-for="ranking in rankings"
            :key="ranking.title"
            :title="ranking.title"
            size="small"
          >
            <Table
              :columns="columns"
              :data-source="ranking.rows"
              :pagination="false"
              row-key="key"
              size="small"
            >
              <template #bodyCell="{ column, record }">
                <span v-if="column.key === 'bytes'">{{
                  formatFileSize(record.bytes)
                }}</span>
              </template>
            </Table>
          </Card>
        </div>
      </template>
      <Empty
        v-else-if="!loading && !errorText"
        description="请选择统计时间范围"
      />
    </Spin>
  </Card>
</template>
