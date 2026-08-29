<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Button, Image, message, Popconfirm, Space, Tag } from 'antdv-next';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import {
  getList,
  getReplyList,
  postDone,
  postSave,
} from '#/api/res/seas/set/feedback';

import { useColumns, useGridFormSchema } from './data';
import DeviceInfoModal from './DeviceInfoModal.vue';
import ReplyModal from './Modal.vue';

const replyOpen = ref(false);
const deviceOpen = ref(false);
const activeThread = ref<any>({ info: {}, items: [] });
const activeRecord = ref<any>({});

function normalizeRows(payload: any) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.records)) return payload.records;
  if (payload && typeof payload === 'object') return [payload];
  return [];
}

function normalizeTotal(payload: any, list: any[]) {
  return Number(payload?.total ?? payload?.count ?? list.length);
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          const payload = await getList({
            ...formValues,
            descending: true,
            page: page.currentPage,
            size: page.pageSize,
            sort: 'created_at',
          });
          const items = normalizeRows(payload);
          return { items, total: normalizeTotal(payload, items) };
        },
      },
    },
    rowConfig: { keyField: 'id' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions,
});

function contentMsg(record: any) {
  const content = record?.content;
  if (!content) return '';
  if (typeof content === 'string') return content;
  return content.msg ?? content.text ?? JSON.stringify(content);
}

function contentImgs(record: any): string[] {
  const imgs = record?.content?.imgs;
  if (!Array.isArray(imgs)) return [];
  return imgs
    .map((item) => (typeof item === 'string' ? item : item?.url))
    .filter(Boolean);
}

async function openReply(record: any) {
  activeRecord.value = record;
  activeThread.value = await getReplyList(record.id);
  replyOpen.value = true;
}

function openDevice(record: any) {
  activeRecord.value = record;
  deviceOpen.value = true;
}

async function submitReply(payload: any) {
  await postSave({ id: activeRecord.value.id, ...payload });
  message.success('回复成功');
  replyOpen.value = false;
  await gridApi.query();
}

async function finish(record: any) {
  await postDone(record.id);
  message.success('已完结');
  await gridApi.query();
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
    title="用户反馈"
  >
    <Grid class="management-grid" table-title="用户反馈">
      <template #content="{ row }">
        <Space direction="vertical" size="small">
          <span>{{ contentMsg(row) }}</span>
          <Space v-if="contentImgs(row).length" wrap>
            <Image
              v-for="url in contentImgs(row)"
              :key="url"
              :src="url"
              :width="48"
            />
          </Space>
        </Space>
      </template>
      <template #isDone="{ row }">
        <Tag :color="row.is_done ? 'success' : 'warning'">
          {{ row.is_done ? '已完结' : '处理中' }}
        </Tag>
      </template>
      <template #boolTag="{ row, column }">
        <Tag :color="row[column.field] ? 'processing' : 'default'">
          {{ row[column.field] ? '是' : '否' }}
        </Tag>
      </template>
      <template #operation="{ row }">
        <VbenTableAction
          :actions="[
            {
              icon: 'lucide:message-circle-reply',
              onClick: () => openReply(row),
              text: '查看/回复',
            },
            {
              icon: 'lucide:monitor-smartphone',
              onClick: () => openDevice(row),
              text: '设备',
            },
          ]"
          align="center"
        />
        <Popconfirm
          v-if="!row.is_done"
          title="确认完结该反馈？"
          @confirm="finish(row)"
        >
          <Button size="small" type="link">完结</Button>
        </Popconfirm>
      </template>
    </Grid>

    <ReplyModal
      v-model:open="replyOpen"
      :thread="activeThread"
      @submit="submitReply"
    />
    <DeviceInfoModal v-model:open="deviceOpen" :record="activeRecord" />
  </Page>
</template>
