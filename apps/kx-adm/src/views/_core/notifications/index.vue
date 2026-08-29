<script lang="ts" setup>
import type { NotifyInboxItem, NotifyInboxSourceType } from '#/api/notify';

import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';
import {
  CircleCheckBig,
  CircleX,
  List,
  MailCheck,
  RotateCw,
} from '@vben/icons';

import {
  Button,
  Empty,
  Popconfirm,
  Segmented,
  Skeleton,
  Space,
  Tag,
  Tooltip,
} from 'antdv-next';

import { useNotifyInboxStore } from '#/store';
import { Times } from '#/times';

defineOptions({ name: 'Notifications' });

type ReadFilter = 'all' | 'unread';
type SourceFilter = 'all' | NotifyInboxSourceType;

const router = useRouter();
const notifyInboxStore = useNotifyInboxStore();
const readFilter = ref<ReadFilter>('all');
const sourceFilter = ref<SourceFilter>('all');

const readOptions = [
  { label: '全部', value: 'all' },
  { label: '未读', value: 'unread' },
];
const sourceOptions = [
  { label: '全部来源', value: 'all' },
  { label: '平台任务', value: 'task_run' },
  { label: 'Push', value: 'delivery_recipient' },
];

const visibleItems = computed(() =>
  notifyInboxStore.items.filter(
    (item) =>
      (readFilter.value === 'all' || !item.read) &&
      (sourceFilter.value === 'all' || item.source_type === sourceFilter.value),
  ),
);
const emptyDescription = computed(() => {
  if (notifyInboxStore.items.length === 0) return '暂无通知';
  if (readFilter.value === 'unread') return '当前筛选下没有未读通知';
  return '当前来源下暂无通知';
});

function sourceLabel(sourceType: NotifyInboxSourceType) {
  return sourceType === 'task_run' ? '平台任务' : 'Push';
}

function statusColor(status: string) {
  if (status === 'failed') return 'error';
  if (status === 'succeeded') return 'success';
  if (status === 'running') return 'processing';
  if (status === 'queued' || status === 'retry') return 'warning';
  return 'default';
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    cancelled: '已取消',
    failed: '失败',
    queued: '排队中',
    retry: '重试中',
    running: '执行中',
    succeeded: '已完成',
  };
  return labels[status] ?? status;
}

async function markRead(item: NotifyInboxItem) {
  if (item.read) return;
  await notifyInboxStore.markRead(item.source_type, item.source_id);
}

async function openItem(item: NotifyInboxItem) {
  await markRead(item);
  if (item.link) await router.push(item.link);
}

async function dismiss(item: NotifyInboxItem) {
  await notifyInboxStore.dismiss(item.source_type, item.source_id);
}

onMounted(() => {
  void notifyInboxStore.load().catch(() => undefined);
});
</script>

<template>
  <Page title="通知中心" content-class="notification-center-content">
    <div class="notification-toolbar" aria-label="通知筛选与批量操作">
      <div class="filter-group">
        <Segmented
          v-model:value="readFilter"
          aria-label="按已读状态筛选通知"
          :options="readOptions"
        />
        <Segmented
          v-model:value="sourceFilter"
          aria-label="按来源筛选通知"
          :options="sourceOptions"
        />
      </div>
      <Space wrap>
        <Button
          :disabled="notifyInboxStore.unreadCount === 0"
          @click="notifyInboxStore.markAllRead"
        >
          <CircleCheckBig class="size-4" />
          全部已读
        </Button>
        <Popconfirm
          cancel-text="取消"
          ok-text="确认清空"
          title="确认清空全部通知？"
          @confirm="notifyInboxStore.clear"
        >
          <Button :disabled="notifyInboxStore.items.length === 0" danger>
            <CircleX class="size-4" />
            清空
          </Button>
        </Popconfirm>
        <Tooltip title="刷新通知">
          <Button
            :loading="notifyInboxStore.loading"
            aria-label="刷新通知"
            shape="circle"
            @click="notifyInboxStore.load(true)"
          >
            <RotateCw class="size-4" />
          </Button>
        </Tooltip>
      </Space>
    </div>

    <Skeleton
      v-if="notifyInboxStore.loading && !notifyInboxStore.initialized"
      active
      :paragraph="{ rows: 8 }"
    />
    <Empty
      v-else-if="notifyInboxStore.loadFailed && !notifyInboxStore.initialized"
      description="通知加载失败"
    >
      <Button type="primary" @click="notifyInboxStore.load(true)">
        <RotateCw class="size-4" />
        重新加载
      </Button>
    </Empty>
    <Empty
      v-else-if="visibleItems.length === 0"
      :description="emptyDescription"
    >
      <Button
        v-if="notifyInboxStore.items.length > 0"
        @click="
          readFilter = 'all';
          sourceFilter = 'all';
        "
      >
        查看全部通知
      </Button>
    </Empty>

    <ul v-else class="notification-list" aria-label="通知列表">
      <li
        v-for="item in visibleItems"
        :key="`${item.source_type}:${item.source_id}`"
        class="notification-row"
        :class="{ unread: !item.read }"
        role="button"
        tabindex="0"
        @click="openItem(item)"
        @keydown.enter.prevent="openItem(item)"
        @keydown.space.prevent="openItem(item)"
      >
        <div class="source-icon">
          <List v-if="item.source_type === 'task_run'" class="size-5" />
          <MailCheck v-else class="size-5" />
        </div>
        <div class="notification-body">
          <div class="notification-title-row">
            <h2>{{ item.title }}</h2>
            <span v-if="!item.read" class="unread-dot" aria-label="未读"></span>
          </div>
          <p>{{ item.content || '-' }}</p>
          <div class="notification-meta">
            <Tag>{{ sourceLabel(item.source_type) }}</Tag>
            <Tag :color="statusColor(item.status)">
              {{ statusLabel(item.status) }}
            </Tag>
            <time>{{ Times.formatUnix(item.event_at) }}</time>
          </div>
        </div>
        <div class="notification-actions" @click.stop>
          <Tooltip v-if="!item.read" title="标为已读">
            <Button
              aria-label="标为已读"
              shape="circle"
              size="small"
              type="text"
              @click="markRead(item)"
            >
              <CircleCheckBig class="size-4" />
            </Button>
          </Tooltip>
          <Popconfirm
            cancel-text="取消"
            ok-text="确认清除"
            title="确认清除这条通知？"
            @confirm="dismiss(item)"
          >
            <Tooltip title="清除通知">
              <Button
                aria-label="清除通知"
                danger
                shape="circle"
                size="small"
                type="text"
              >
                <CircleX class="size-4" />
              </Button>
            </Tooltip>
          </Popconfirm>
        </div>
      </li>
    </ul>
  </Page>
</template>

<style scoped>
.notification-toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 0 0 16px;
}

.filter-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}

.notification-list {
  padding: 0;
  margin: 0;
  list-style: none;
  border-block: 1px solid hsl(var(--border));
}

.notification-row {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: start;
  min-width: 0;
  padding: 16px;
  cursor: pointer;
  outline: none;
  background: hsl(var(--background));
}

.notification-row + .notification-row {
  border-top: 1px solid hsl(var(--border));
}

.notification-row:hover,
.notification-row:focus-visible,
.notification-row.unread {
  background: hsl(var(--accent) / 55%);
}

.notification-row:focus-visible {
  box-shadow: inset 0 0 0 2px hsl(var(--ring));
}

.source-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  color: hsl(var(--foreground));
  background: hsl(var(--muted) / 45%);
  border: 1px solid hsl(var(--border));
}

.notification-body {
  min-width: 0;
}

.notification-title-row {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.notification-title-row h2 {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0;
  white-space: nowrap;
}

.unread-dot {
  flex: none;
  width: 7px;
  height: 7px;
  background: hsl(var(--primary));
  border-radius: 2px;
}

.notification-body p {
  display: -webkit-box;
  margin: 6px 0 10px;
  overflow: hidden;
  -webkit-line-clamp: 2;
  font-size: 13px;
  line-height: 1.6;
  color: hsl(var(--muted-foreground));
  -webkit-box-orient: vertical;
}

.notification-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.notification-actions {
  display: flex;
  gap: 4px;
}

@media (max-width: 640px) {
  .notification-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .notification-row {
    grid-template-columns: 36px minmax(0, 1fr);
    gap: 10px;
    padding: 14px 8px;
  }

  .source-icon {
    width: 36px;
    height: 36px;
  }

  .notification-actions {
    grid-column: 2;
    justify-content: flex-end;
  }
}
</style>
