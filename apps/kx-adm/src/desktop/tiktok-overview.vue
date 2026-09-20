<script setup lang="ts">
import type { TikTokVideoFile } from './tiktok';

import { computed } from 'vue';

import { Progress } from 'antdv-next';

import { isTikTokRunning, localDateTime } from './tiktok';

const props = defineProps<{ files: TikTokVideoFile[]; filter: string }>();
const emit = defineEmits<{ filter: [value: string] }>();
const groups = computed(() => [
  {
    key: '',
    label: '全部视频',
    value: props.files.length,
    color: 'bg-slate-500',
  },
  {
    key: 'pending',
    label: '待处理',
    value: props.files.filter((f) => ['pending', 'ready'].includes(f.status))
      .length,
    color: 'bg-blue-500',
  },
  {
    key: 'running',
    label: '执行中',
    value: props.files.filter(isTikTokRunning).length,
    color: 'bg-cyan-500',
  },
  {
    key: 'scheduled',
    label: '已预约',
    value: props.files.filter((f) => f.status === 'scheduled').length,
    color: 'bg-emerald-500',
  },
  {
    key: 'issues',
    label: '需处理',
    value: props.files.filter((f) => ['failed', 'review'].includes(f.status))
      .length,
    color: 'bg-amber-500',
  },
]);
const uploaded = computed(() => {
  const size = props.files.reduce((sum, f) => sum + f.size, 0);
  const bytes = props.files.reduce(
    (sum, f) => sum + Math.min(f.size, Math.max(0, f.bytes)),
    0,
  );
  return { size, bytes, percent: size ? Math.round((bytes / size) * 100) : 0 };
});
const days = computed(() => {
  const map = new Map<
    string,
    { day: string; planned: number; accepted: number }
  >();
  for (const file of props.files) {
    if (!file.schedule) continue;
    const day = localDateTime(file.schedule.scheduledAt).slice(0, 10);
    const item = map.get(day) ?? { day, planned: 0, accepted: 0 };
    item.planned += 1;
    if (file.status === 'scheduled') item.accepted += 1;
    map.set(day, item);
  }
  return [...map.values()].toSorted((a, b) => a.day.localeCompare(b.day));
});
const maxDay = computed(() => Math.max(1, ...days.value.map((d) => d.planned)));
function size(value: number) {
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KiB`;
  return `${(value / 1024 ** 2).toFixed(1)} MiB`;
}
</script>
<template>
  <section aria-label="视频数据概览" class="space-y-4">
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <button
        v-for="group in groups"
        :key="group.key"
        type="button"
        :aria-pressed="filter === group.key"
        class="rounded-lg border bg-card p-4 text-left transition hover:border-primary"
        :class="
          filter === group.key ? 'border-primary ring-1 ring-primary' : ''
        "
        @click="emit('filter', group.key)"
      >
        <span class="text-sm text-muted-foreground">{{ group.label }}</span>
        <div class="mt-2 text-3xl font-semibold tabular-nums">
          {{ group.value }}
        </div>
        <div class="mt-3 h-1 rounded bg-muted">
          <div
            :class="group.color"
            class="h-1 rounded"
            :style="{
              width: `${files.length ? (group.value / files.length) * 100 : 0}%`,
            }"
          ></div>
        </div>
      </button>
    </div>
    <div class="grid gap-4 md:grid-cols-2">
      <div class="rounded-lg border bg-card p-4">
        <h2 class="font-semibold">素材上传进度</h2>
        <Progress :percent="uploaded.percent" />
        <p class="text-sm text-muted-foreground">
          {{ size(uploaded.bytes) }} / {{ size(uploaded.size) }} ·
          上传完成后仍需检测及提交预约
        </p>
      </div>
      <div class="rounded-lg border bg-card p-4">
        <h2 class="mb-3 font-semibold">预约分布（本机时区）</h2>
        <p v-if="!days.length" class="text-sm text-muted-foreground">
          保存预约计划后展示按日分布
        </p>
        <div
          v-else
          class="max-h-44 space-y-2 overflow-auto"
          role="list"
          aria-label="每日预约数量"
        >
          <div
            v-for="day in days"
            :key="day.day"
            role="listitem"
            class="grid grid-cols-[6rem_1fr_6rem] items-center gap-2 text-xs"
          >
            <span>{{ day.day }}</span>
            <div class="h-3 rounded bg-muted">
              <div
                class="h-3 rounded bg-blue-200"
                :style="{ width: `${(day.planned / maxDay) * 100}%` }"
              >
                <div
                  class="h-3 rounded bg-emerald-500"
                  :style="{ width: `${(day.accepted / day.planned) * 100}%` }"
                ></div>
              </div>
            </div>
            <span>{{ day.accepted }} 已预约 / {{ day.planned }} 计划</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
