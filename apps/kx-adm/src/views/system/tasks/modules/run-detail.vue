<script lang="ts" setup>
import type { TaskRun } from '#/api/task';

import { computed } from 'vue';

import { Alert, Button, Drawer, Skeleton, Tag } from 'antdv-next';

import { displayValue } from '#/management';
import { Times } from '#/times';

import { taskStatusColor, taskStatusLabel, taskTriggerLabel } from '../data';

const props = defineProps<{
  loading?: boolean;
  task?: TaskRun;
}>();
const emit = defineEmits<{ businessDetail: [task: TaskRun] }>();
const open = defineModel<boolean>('open', { default: false });

const hasError = computed(() =>
  Boolean(props.task?.error_code || props.task?.error_message),
);

const staleHint = computed(() => {
  const task = props.task;
  if (!task || task.status !== 'running') return '';
  const updatedAt = Number(task.heartbeat_at || task.updated_at || 0);
  const now = Math.floor(Date.now() / 1000);
  return updatedAt > 0 && now - updatedAt > 1800
    ? '疑似中断：超过 30 分钟未更新'
    : '';
});
</script>

<template>
  <Drawer
    v-model:open="open"
    destroy-on-close
    :footer="false"
    :title="`执行详情 · #${displayValue(task?.id)}`"
    :size="760"
  >
    <Skeleton v-if="loading" active :paragraph="{ rows: 10 }" />

    <div v-else-if="task" class="run-detail">
      <header class="run-summary">
        <div class="run-summary__status">
          <Tag :color="taskStatusColor(task.status)">
            {{ taskStatusLabel(task.status) }}
          </Tag>
          <span class="run-summary__trigger">
            {{ taskTriggerLabel(task.trigger) }}触发
          </span>
        </div>
        <code class="run-code run-summary__executor">
          {{ task.executor_code }}
        </code>
        <p class="run-summary__message">{{ displayValue(task.message) }}</p>
      </header>

      <Alert
        v-if="staleHint"
        class="run-alert"
        show-icon
        :message="staleHint"
        type="warning"
      />

      <section class="run-section">
        <h3>执行信息</h3>
        <dl class="run-grid">
          <div class="run-field">
            <dt>调度配置</dt>
            <dd>{{ displayValue(task.schedule_name) }}</dd>
          </div>
          <div class="run-field">
            <dt>尝试次数</dt>
            <dd>{{ task.attempt }} / {{ task.max_attempts }}</dd>
          </div>
          <div class="run-field run-field--wide">
            <dt>业务键</dt>
            <dd>
              <code class="run-code">{{ task.biz_key }}</code>
            </dd>
          </div>
          <div class="run-field run-field--wide">
            <dt>业务详情</dt>
            <dd>
              <Button
                v-if="task.detail_path"
                class="run-detail-link"
                size="small"
                type="link"
                @click="emit('businessDetail', task)"
              >
                {{ task.detail_label || task.detail_path }}
              </Button>
              <span v-else>-</span>
            </dd>
          </div>
        </dl>
      </section>

      <section class="run-section">
        <h3>批量进度</h3>
        <dl class="run-progress">
          <div class="run-progress__item">
            <dt>总数</dt>
            <dd>{{ displayValue(task.total_count) }}</dd>
          </div>
          <div class="run-progress__item">
            <dt>执行中</dt>
            <dd>{{ task.running_count }}</dd>
          </div>
          <div class="run-progress__item run-progress__item--success">
            <dt>成功</dt>
            <dd>{{ task.succeeded_count }}</dd>
          </div>
          <div class="run-progress__item run-progress__item--error">
            <dt>失败</dt>
            <dd>{{ task.failed_count }}</dd>
          </div>
        </dl>
      </section>

      <section class="run-section">
        <h3>时间记录</h3>
        <dl class="run-grid">
          <div class="run-field">
            <dt>计划时间</dt>
            <dd>{{ Times.formatUnix(task.scheduled_at) }}</dd>
          </div>
          <div class="run-field">
            <dt>入队时间</dt>
            <dd>{{ Times.formatUnix(task.queued_at) }}</dd>
          </div>
          <div class="run-field">
            <dt>开始时间</dt>
            <dd>{{ Times.formatOptionalUnix(task.started_at) }}</dd>
          </div>
          <div class="run-field">
            <dt>完成时间</dt>
            <dd>{{ Times.formatOptionalUnix(task.finished_at) }}</dd>
          </div>
          <div class="run-field">
            <dt>最近心跳</dt>
            <dd>{{ Times.formatOptionalUnix(task.heartbeat_at) }}</dd>
          </div>
          <div class="run-field">
            <dt>下次重试</dt>
            <dd>{{ Times.formatOptionalUnix(task.next_retry_at) }}</dd>
          </div>
          <div class="run-field run-field--wide">
            <dt>取消请求</dt>
            <dd>{{ Times.formatOptionalUnix(task.cancel_requested_at) }}</dd>
          </div>
        </dl>
      </section>

      <section v-if="hasError" class="run-section run-section--error">
        <h3>异常信息</h3>
        <dl class="run-grid">
          <div class="run-field">
            <dt>错误编码</dt>
            <dd>
              <code class="run-code">{{ displayValue(task.error_code) }}</code>
            </dd>
          </div>
          <div class="run-field run-field--wide">
            <dt>错误摘要</dt>
            <dd class="run-error-message">
              {{ displayValue(task.error_message) }}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  </Drawer>
</template>

<style scoped>
.run-detail {
  padding-bottom: 8px;
  color: hsl(var(--foreground));
}

.run-summary {
  padding-bottom: 18px;
  border-bottom: 1px solid hsl(var(--border));
}

.run-summary__status {
  display: flex;
  gap: 6px;
  align-items: center;
  min-height: 24px;
}

.run-summary__trigger {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.run-summary__executor {
  display: block;
  margin-top: 10px;
  font-size: 14px;
  font-weight: 600;
}

.run-summary__message {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: hsl(var(--muted-foreground));
  overflow-wrap: anywhere;
}

.run-alert {
  margin-top: 16px;
}

.run-section {
  padding-top: 20px;
}

.run-section + .run-section {
  padding-top: 20px;
  margin-top: 20px;
  border-top: 1px solid hsl(var(--border));
}

.run-section h3 {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  letter-spacing: 0;
}

.run-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px 28px;
  margin: 0;
}

.run-field {
  min-width: 0;
}

.run-field--wide {
  grid-column: 1 / -1;
}

.run-field dt,
.run-progress dt {
  margin-bottom: 4px;
  font-size: 12px;
  line-height: 1.4;
  color: hsl(var(--muted-foreground));
}

.run-field dd {
  min-height: 22px;
  margin: 0;
  font-size: 14px;
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.run-code {
  max-width: 100%;
  font-size: 12px;
  line-height: 1.55;
  color: inherit;
  letter-spacing: 0;
  overflow-wrap: anywhere;
  white-space: normal;
}

.run-detail-link {
  height: auto;
  padding: 0;
  font-size: 14px;
  white-space: normal;
}

.run-progress {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 0;
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.run-progress__item {
  min-width: 0;
  padding: 12px 14px;
}

.run-progress__item + .run-progress__item {
  border-left: 1px solid hsl(var(--border));
}

.run-progress__item dd {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.3;
}

.run-progress__item--success dd {
  color: hsl(var(--success));
}

.run-progress__item--error dd {
  color: hsl(var(--destructive));
}

.run-section--error h3,
.run-error-message {
  color: hsl(var(--destructive));
}

@media (max-width: 640px) {
  .run-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 14px;
  }

  .run-field--wide {
    grid-column: auto;
  }

  .run-progress {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .run-progress__item:nth-child(3) {
    border-left: 0;
  }

  .run-progress__item:nth-child(n + 3) {
    border-top: 1px solid hsl(var(--border));
  }
}
</style>
