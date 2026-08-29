<script lang="ts" setup>
import type { AuditLog } from '#/api/system/audit-log';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { Descriptions, DescriptionsItem, TabPane, Tabs, Tag } from 'antdv-next';

import { AuditLogApi } from '#/api/system/audit-log';
import { Times } from '#/times';

const detail = ref<AuditLog>();
const loading = ref(false);
const title = computed(() =>
  detail.value ? `${detail.value.method} ${detail.value.api_path}` : '审计详情',
);

const [Drawer, drawerApi] = useVbenDrawer<AuditLog>({
  async onOpenChange(isOpen) {
    if (!isOpen) return;
    const row = drawerApi.getData();
    if (!row) return;
    loading.value = true;
    try {
      detail.value = await AuditLogApi.detail(row.id);
    } finally {
      loading.value = false;
    }
  },
});

function formatJson(value: unknown) {
  return value === undefined || value === null
    ? '-'
    : JSON.stringify(value, null, 2);
}
</script>

<template>
  <Drawer
    class="w-full max-w-300"
    :footer="false"
    :loading="loading"
    :title="title"
  >
    <Descriptions v-if="detail" bordered :column="2" size="small">
      <DescriptionsItem label="用户 ID">{{ detail.uid }}</DescriptionsItem>
      <DescriptionsItem label="完成时间">
        {{ Times.formatUnix(detail.created_at) }}
      </DescriptionsItem>
      <DescriptionsItem label="HTTP 状态">
        {{ detail.http_status }}
      </DescriptionsItem>
      <DescriptionsItem label="业务码">
        {{ detail.response_code || '-' }}
      </DescriptionsItem>
      <DescriptionsItem label="耗时">
        {{ detail.duration_ms }} ms
      </DescriptionsItem>
      <DescriptionsItem label="模式">
        <Tag :color="detail.debug_enabled ? 'processing' : 'default'">
          {{ detail.debug_enabled ? '调试' : '普通' }}
        </Tag>
      </DescriptionsItem>
      <DescriptionsItem label="来源 IP">
        {{ detail.remote_ip || '-' }}
      </DescriptionsItem>
      <DescriptionsItem label="User-Agent">
        {{ detail.user_agent || '-' }}
      </DescriptionsItem>
    </Descriptions>

    <Tabs v-if="detail" class="mt-4">
      <TabPane key="request" tab="请求链路">
        <h3>Headers</h3>
        <pre>{{ formatJson(detail.request_headers) }}</pre>
        <h3>Query</h3>
        <pre>{{
          formatJson(detail.request_query || detail.query_summary)
        }}</pre>
        <h3>Body</h3>
        <pre>{{ formatJson(detail.request_body) }}</pre>
      </TabPane>
      <TabPane key="response" tab="响应链路">
        <h3>Headers</h3>
        <pre>{{ formatJson(detail.response_headers) }}</pre>
        <h3>Body</h3>
        <pre>{{ formatJson(detail.response_body) }}</pre>
      </TabPane>
    </Tabs>
  </Drawer>
</template>

<style scoped>
h3 {
  margin: 12px 0 6px;
  font-size: 13px;
  font-weight: 600;
}

pre {
  max-height: 320px;
  padding: 10px;
  margin: 0;
  overflow: auto;
  font-size: 12px;
  line-height: 1.55;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  background: hsl(var(--muted));
  border: 1px solid hsl(var(--border));
  border-radius: 4px;
}
</style>
