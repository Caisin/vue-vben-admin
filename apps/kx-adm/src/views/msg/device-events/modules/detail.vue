<script lang="ts" setup>
import type { DeviceEventDetail } from '#/api/msg';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';
import { Copy } from '@vben/icons';

import {
  Button,
  Descriptions,
  DescriptionsItem,
  message,
  Tag,
  Tooltip,
  TypographyParagraph,
} from 'antdv-next';

import { DeviceEventApi } from '#/api/msg';
import { StatusTag } from '#/components/management';
import { displayValue } from '#/management';
import { Times } from '#/times';

import { eventKindColor, eventKindLabel, formatPayload } from '../data';

const drawerLoading = ref(false);
const selectedEvent = ref<DeviceEventDetail | null>(null);
const selectedPayloadText = computed(() =>
  selectedEvent.value ? formatPayload(selectedEvent.value.payload_json) : '',
);

const [Drawer, drawerApi] = useVbenDrawer<{ eventId: number }>({
  async onOpenChange(isOpen) {
    if (!isOpen) return;
    const data = drawerApi.getData();
    const eventId = data?.eventId;
    if (!eventId) return;
    selectedEvent.value = null;
    drawerLoading.value = true;
    try {
      selectedEvent.value = await DeviceEventApi.detail(eventId);
    } finally {
      drawerLoading.value = false;
    }
  },
});

async function copyValue(label: string, value: string) {
  await navigator.clipboard.writeText(value);
  message.success(`${label}已复制`);
}

async function copySelectedPayload() {
  await copyValue('原始 Payload', selectedPayloadText.value);
}
</script>

<template>
  <Drawer :loading="drawerLoading" size="min(780px, 100vw)" title="事件详情">
    <template v-if="selectedEvent">
      <Descriptions :column="{ xs: 1, sm: 2 }" bordered size="small">
        <DescriptionsItem label="事件 ID">
          {{ selectedEvent.id }}
        </DescriptionsItem>
        <DescriptionsItem label="事件类型">
          <Tag :color="eventKindColor(selectedEvent.event_kind)">
            {{ eventKindLabel(selectedEvent.event_kind) }}
          </Tag>
        </DescriptionsItem>
        <DescriptionsItem label="设备编号">
          {{ displayValue(selectedEvent.device_code) }}
        </DescriptionsItem>
        <DescriptionsItem label="处理状态">
          <StatusTag :status="selectedEvent.process_status" />
        </DescriptionsItem>
        <DescriptionsItem label="接收时间">
          {{ Times.formatUnix(selectedEvent.received_at) }}
        </DescriptionsItem>
        <DescriptionsItem label="处理时间">
          {{ Times.formatUnix(selectedEvent.processed_at) }}
        </DescriptionsItem>
      </Descriptions>

      <section class="detail-block">
        <div class="detail-block-heading">
          <h2>MQTT Topic</h2>
          <Tooltip title="复制 Topic">
            <Button
              aria-label="复制 MQTT Topic"
              shape="circle"
              size="small"
              type="text"
              @click="copyValue('MQTT Topic', selectedEvent.mqtt_topic)"
            >
              <template #icon><Copy /></template>
            </Button>
          </Tooltip>
        </div>
        <TypographyParagraph class="content-box code-box">
          {{ selectedEvent.mqtt_topic }}
        </TypographyParagraph>
      </section>

      <section class="detail-block">
        <div class="detail-block-heading">
          <h2>原始 Payload</h2>
          <Tooltip title="复制原始 Payload">
            <Button
              aria-label="复制原始 Payload"
              shape="circle"
              size="small"
              type="text"
              @click="copySelectedPayload"
            >
              <template #icon><Copy /></template>
            </Button>
          </Tooltip>
        </div>
        <TypographyParagraph class="content-box code-box">
          {{ selectedPayloadText }}
        </TypographyParagraph>
      </section>

      <section class="detail-block">
        <div class="detail-block-heading">
          <h2>错误信息</h2>
          <Tooltip title="复制错误信息">
            <Button
              aria-label="复制错误信息"
              :disabled="!selectedEvent.error_message"
              shape="circle"
              size="small"
              type="text"
              @click="copyValue('错误信息', selectedEvent.error_message)"
            >
              <template #icon><Copy /></template>
            </Button>
          </Tooltip>
        </div>
        <TypographyParagraph class="content-box">
          {{ displayValue(selectedEvent.error_message) }}
        </TypographyParagraph>
      </section>
    </template>
  </Drawer>
</template>

<style scoped>
.detail-block {
  margin-top: 20px;
}

.detail-block-heading {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
}

.detail-block h2 {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0;
}

.content-box {
  min-height: 48px;
  padding: 12px;
  margin: 0;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  background: hsl(var(--muted));
  border-radius: 4px;
}

.code-box {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
}
</style>
